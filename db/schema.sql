CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  phone VARCHAR(20),
  username VARCHAR(100),
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS businesses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 100,
  qr_token VARCHAR(50) UNIQUE NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  reward_amount INTEGER NOT NULL,
  max_visits INTEGER NOT NULL,
  visits_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  ends_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS visits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  rewarded INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  phone VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS task_type VARCHAR(20) NOT NULL DEFAULT 'visit';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS task_description TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS requires_pin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS budget INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- reward_amount = floor((budget * 0.9) / max_visits)
-- The 10% commission is deducted from business balance upfront at campaign creation
-- and credited to platform_wallet atomically via create_campaign_with_commission().

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_telegram_id BIGINT;

CREATE TABLE IF NOT EXISTS verification_pins (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  pin VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topup_requests (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION confirm_topup(p_request_id INTEGER)
RETURNS void AS $$
DECLARE
  v_amount      INTEGER;
  v_business_id INTEGER;
BEGIN
  SELECT amount, business_id INTO v_amount, v_business_id
    FROM topup_requests
   WHERE id = p_request_id AND status = 'pending'
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  UPDATE topup_requests
     SET status = 'confirmed', processed_at = NOW()
   WHERE id = p_request_id;

  UPDATE businesses
     SET balance = balance + v_amount
   WHERE id = v_business_id;
END;
$$ LANGUAGE plpgsql;

-- Platform wallet: single-row accumulator for all commission earnings
CREATE TABLE IF NOT EXISTS platform_wallet (
  id      INTEGER PRIMARY KEY DEFAULT 1,
  balance BIGINT  NOT NULL DEFAULT 0,
  CHECK (id = 1)
);
INSERT INTO platform_wallet (id, balance) VALUES (1, 0) ON CONFLICT DO NOTHING;

-- Per-campaign commission audit trail
CREATE TABLE IF NOT EXISTS platform_transactions (
  id          SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic campaign creation: locks business row, deducts commission upfront,
-- credits platform_wallet, inserts campaign, records audit entry.
-- Returns the new campaign id.
CREATE OR REPLACE FUNCTION create_campaign_with_commission(
  p_business_id      INTEGER,
  p_budget           INTEGER,
  p_reward_amount    INTEGER,
  p_max_visits       INTEGER,
  p_task_type        VARCHAR,
  p_task_description TEXT,
  p_requires_pin     BOOLEAN,
  p_ends_at          TIMESTAMPTZ
) RETURNS INTEGER AS $$
DECLARE
  v_biz_balance INTEGER;
  v_commission  INTEGER;
  v_campaign_id INTEGER;
BEGIN
  SELECT balance INTO v_biz_balance
    FROM businesses WHERE id = p_business_id FOR UPDATE;

  IF v_biz_balance < p_budget THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  -- commission = budget - (reward * visits), always >= 10% due to Math.floor
  v_commission := p_budget - (p_reward_amount * p_max_visits);

  UPDATE businesses
     SET balance = balance - v_commission
   WHERE id = p_business_id;

  UPDATE platform_wallet
     SET balance = balance + v_commission
   WHERE id = 1;

  INSERT INTO campaigns (
    business_id, budget, reward_amount, max_visits,
    task_type, task_description, requires_pin, ends_at, active
  ) VALUES (
    p_business_id, p_budget, p_reward_amount, p_max_visits,
    p_task_type, p_task_description, p_requires_pin, p_ends_at, true
  ) RETURNING id INTO v_campaign_id;

  INSERT INTO platform_transactions (campaign_id, business_id, amount)
  VALUES (v_campaign_id, p_business_id, v_commission);

  RETURN v_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Atomic checkin: balance check, insert visit, adjust balances, auto-stop exhausted campaigns
CREATE OR REPLACE FUNCTION process_checkin(
  p_user_id     INTEGER,
  p_business_id INTEGER,
  p_campaign_id INTEGER,
  p_lat         DECIMAL,
  p_lng         DECIMAL,
  p_reward      INTEGER
) RETURNS void AS $$
DECLARE
  v_biz_balance  INTEGER;
  v_visits_count INTEGER;
  v_max_visits   INTEGER;
BEGIN
  -- Lock business row and verify funds atomically
  SELECT balance INTO v_biz_balance
    FROM businesses WHERE id = p_business_id FOR UPDATE;

  IF v_biz_balance < p_reward THEN
    RAISE EXCEPTION 'BUSINESS_INSUFFICIENT_FUNDS';
  END IF;

  -- Verify campaign slot is still available (race-condition safe)
  SELECT visits_count, max_visits INTO v_visits_count, v_max_visits
    FROM campaigns WHERE id = p_campaign_id FOR UPDATE;

  IF v_visits_count >= v_max_visits THEN
    RAISE EXCEPTION 'NO_ACTIVE_CAMPAIGN';
  END IF;

  INSERT INTO visits (user_id, business_id, campaign_id, lat, lng, rewarded)
  VALUES (p_user_id, p_business_id, p_campaign_id, p_lat, p_lng, p_reward);

  UPDATE campaigns
     SET visits_count = visits_count + 1
   WHERE id = p_campaign_id;

  UPDATE businesses
     SET balance = balance - p_reward
   WHERE id = p_business_id;

  -- Auto-stop any campaign the business can no longer afford
  UPDATE campaigns
     SET active = false
   WHERE business_id = p_business_id
     AND active = true
     AND reward_amount > (SELECT balance FROM businesses WHERE id = p_business_id);

  UPDATE users
     SET balance = balance + p_reward
   WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Atomic withdrawal: checks balance, deducts it, creates withdrawal record
CREATE OR REPLACE FUNCTION process_withdrawal(
  p_user_id INTEGER,
  p_amount  INTEGER,
  p_phone   VARCHAR
) RETURNS TABLE(new_balance INTEGER, withdrawal_id INTEGER) AS $$
DECLARE
  v_balance     INTEGER;
  v_new_balance INTEGER;
  v_wid         INTEGER;
BEGIN
  SELECT balance INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
  END IF;

  v_new_balance := v_balance - p_amount;

  UPDATE users SET balance = v_new_balance WHERE id = p_user_id;

  INSERT INTO withdrawals (user_id, amount, phone, status)
  VALUES (p_user_id, p_amount, p_phone, 'pending')
  RETURNING id INTO v_wid;

  RETURN QUERY SELECT v_new_balance, v_wid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SuperAdmin additions
-- ============================================================

ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- ── User / Business moderation columns ───────────────────────────────────────
-- banned_at: set by SA ban; NULL = active, non-NULL = banned.
-- Check this in validateTma middleware to block checkins & withdrawals.
ALTER TABLE users      ADD COLUMN IF NOT EXISTS banned_at    TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- ── GEO rate history ─────────────────────────────────────────────────────────
-- Records every intentional GEO→UZS rate change by a super-admin.
-- The live rate is still driven by the GEO_RATE Railway env var;
-- this table is the audit trail so you can see who changed it and when.
CREATE TABLE IF NOT EXISTS geo_rate_history (
  id         SERIAL      PRIMARY KEY,
  rate       NUMERIC     NOT NULL CHECK (rate > 0),
  admin_id   BIGINT      NOT NULL,             -- telegram_id of the SA
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_rate_history_created_at
  ON geo_rate_history (created_at DESC);

-- ── Immutable super-admin audit log ──────────────────────────────────────────
-- Every administrative action (ban, unban, GEO adjust, suspend, rate change)
-- is appended here. Rows are never updated or deleted — append-only by design.
-- Grant INSERT but NOT UPDATE/DELETE to the service role if you want to enforce this at DB level.
CREATE TABLE IF NOT EXISTS sa_audit_log (
  id         SERIAL      PRIMARY KEY,
  action     TEXT        NOT NULL,             -- e.g. 'user_ban', 'geo_credit', 'rate_change'
  admin_id   BIGINT      NOT NULL,             -- telegram_id of the SA who performed the action
  target_id  INTEGER,                          -- user.id or business.id depending on action
  note       TEXT,                             -- human-readable context / reason
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sa_audit_log_created_at
  ON sa_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_audit_log_action
  ON sa_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_sa_audit_log_target_id
  ON sa_audit_log (target_id)
  WHERE target_id IS NOT NULL;

-- Atomic rejection: marks withdrawal as rejected, refunds GEO to user
CREATE OR REPLACE FUNCTION reject_withdrawal(
  p_withdrawal_id INTEGER,
  p_note          TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_user_id INTEGER;
  v_amount  INTEGER;
BEGIN
  SELECT user_id, amount INTO v_user_id, v_amount
    FROM withdrawals
   WHERE id = p_withdrawal_id AND status = 'pending'
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  UPDATE withdrawals
     SET status       = 'rejected',
         note         = p_note,
         processed_at = NOW()
   WHERE id = p_withdrawal_id;

  UPDATE users
     SET balance = balance + v_amount
   WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Gamification additions
-- ============================================================

-- User gamification columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id);

-- Auto-set referral_code = 'ref_<id>' on insert
CREATE OR REPLACE FUNCTION trg_set_referral_code()
RETURNS trigger AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := 'ref_' || NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_referral_code ON users;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION trg_set_referral_code();

-- Backfill existing users
UPDATE users SET referral_code = 'ref_' || id WHERE referral_code IS NULL;

-- ── Streak table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak    INTEGER NOT NULL DEFAULT 0,
  longest_streak    INTEGER NOT NULL DEFAULT 0,
  last_checkin_date DATE,
  freeze_available  SMALLINT NOT NULL DEFAULT 0,
  freeze_used_date  DATE
);

-- ── XP audit log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xp_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_xp_log_user ON xp_log (user_id, created_at DESC);

-- ── Task catalog ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_definitions (
  key         VARCHAR(50) PRIMARY KEY,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('daily', 'weekly', 'onetime')),
  title       TEXT NOT NULL,
  geo_reward  INTEGER NOT NULL DEFAULT 0,
  xp_reward   INTEGER NOT NULL DEFAULT 0,
  requirement JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS user_tasks (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_key    VARCHAR(50) NOT NULL REFERENCES task_definitions(key) ON DELETE CASCADE,
  period_date DATE NOT NULL DEFAULT CURRENT_DATE,
  progress    INTEGER NOT NULL DEFAULT 0,
  completed   BOOLEAN NOT NULL DEFAULT false,
  claimed     BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, task_key, period_date)
);

-- ── Achievement catalog ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievement_definitions (
  key         VARCHAR(50) PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  geo_reward  INTEGER NOT NULL DEFAULT 0,
  xp_reward   INTEGER NOT NULL DEFAULT 0,
  requirement JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key VARCHAR(50) NOT NULL REFERENCES achievement_definitions(key) ON DELETE CASCADE,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_key)
);

-- ── Referrals ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  referrer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  activated     BOOLEAN NOT NULL DEFAULT false,
  activated_at  TIMESTAMPTZ,
  passive_until TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_id);

CREATE TABLE IF NOT EXISTS referral_earnings (
  id          SERIAL PRIMARY KEY,
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_id    INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ref_earnings_referrer ON referral_earnings (referrer_id, created_at DESC);

-- ── Boosts / events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boosts (
  id         SERIAL PRIMARY KEY,
  type       VARCHAR(30) NOT NULL,
  title      TEXT NOT NULL,
  multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  filter     JSONB NOT NULL DEFAULT '{}',
  active     BOOLEAN NOT NULL DEFAULT true
);

-- ── XP / Level RPC ───────────────────────────────────────────────────────────
-- Level thresholds: 1=0, 2=500, 3=2000, 4=6000, 5=15000
CREATE OR REPLACE FUNCTION grant_xp(
  p_user_id INTEGER,
  p_amount  INTEGER,
  p_reason  TEXT
) RETURNS TABLE(new_xp INTEGER, new_level SMALLINT, leveled_up BOOLEAN) AS $$
DECLARE
  v_old_xp    INTEGER;
  v_new_xp    INTEGER;
  v_old_level SMALLINT;
  v_new_level SMALLINT;
BEGIN
  SELECT xp, level INTO v_old_xp, v_old_level
    FROM users WHERE id = p_user_id FOR UPDATE;

  v_new_xp := v_old_xp + p_amount;

  v_new_level := CASE
    WHEN v_new_xp >= 15000 THEN 5
    WHEN v_new_xp >= 6000  THEN 4
    WHEN v_new_xp >= 2000  THEN 3
    WHEN v_new_xp >= 500   THEN 2
    ELSE 1
  END::SMALLINT;

  UPDATE users SET xp = v_new_xp, level = v_new_level WHERE id = p_user_id;
  INSERT INTO xp_log (user_id, amount, reason) VALUES (p_user_id, p_amount, p_reason);

  RETURN QUERY SELECT v_new_xp, v_new_level, (v_new_level > v_old_level);
END;
$$ LANGUAGE plpgsql;

-- ── Bonus payout from platform wallet ────────────────────────────────────────
-- Platform covers gamification multiplier bonuses. Caps at available balance.
CREATE OR REPLACE FUNCTION apply_checkin_bonus(
  p_user_id INTEGER,
  p_amount  INTEGER
) RETURNS void AS $$
DECLARE
  v_wallet BIGINT;
  v_actual INTEGER;
BEGIN
  IF p_amount <= 0 THEN RETURN; END IF;

  SELECT balance INTO v_wallet FROM platform_wallet WHERE id = 1 FOR UPDATE;
  v_actual := LEAST(p_amount, v_wallet::INTEGER);
  IF v_actual <= 0 THEN RETURN; END IF;

  UPDATE platform_wallet SET balance = balance - v_actual WHERE id = 1;
  UPDATE users SET balance = balance + v_actual WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ── Referral activation ───────────────────────────────────────────────────────
-- Idempotent. Grants +25 GEO to referrer, +10 GEO welcome bonus to new user.
-- Only activates within 7 days of referral creation.
CREATE OR REPLACE FUNCTION activate_referral(
  p_referred_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_referrer_id INTEGER;
  v_activated   BOOLEAN;
  v_created_at  TIMESTAMPTZ;
BEGIN
  SELECT referrer_id, activated, created_at
    INTO v_referrer_id, v_activated, v_created_at
    FROM referrals WHERE referred_id = p_referred_id FOR UPDATE;

  IF NOT FOUND OR v_activated THEN RETURN FALSE; END IF;
  IF NOW() - v_created_at > INTERVAL '7 days' THEN RETURN FALSE; END IF;

  UPDATE referrals
     SET activated = true, activated_at = NOW(), passive_until = NOW() + INTERVAL '30 days'
   WHERE referred_id = p_referred_id;

  UPDATE users SET balance = balance + 25 WHERE id = v_referrer_id;
  UPDATE users SET balance = balance + 10 WHERE id = p_referred_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- visit_id is nullable: NULL for the one-time activation bonus, non-NULL for ongoing income entries
ALTER TABLE referral_earnings ALTER COLUMN visit_id DROP NOT NULL;

-- ── Referral passive income (5% for 30 days) ─────────────────────────────────
-- Idempotent: skips if already recorded for this visit.
CREATE OR REPLACE FUNCTION process_referral_income(
  p_referred_id INTEGER,
  p_visit_id    INTEGER,
  p_reward      INTEGER
) RETURNS void AS $$
DECLARE
  v_referrer_id   INTEGER;
  v_passive_until TIMESTAMPTZ;
  v_earning       INTEGER;
BEGIN
  SELECT referrer_id, passive_until INTO v_referrer_id, v_passive_until
    FROM referrals WHERE referred_id = p_referred_id AND activated = true;

  IF NOT FOUND OR v_passive_until < NOW() THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM referral_earnings WHERE visit_id = p_visit_id) THEN RETURN; END IF;

  v_earning := GREATEST(1, FLOOR(p_reward * 0.05)::INTEGER);

  INSERT INTO referral_earnings (referrer_id, referred_id, visit_id, amount)
  VALUES (v_referrer_id, p_referred_id, p_visit_id, v_earning);

  UPDATE users SET balance = balance + v_earning WHERE id = v_referrer_id;
END;
$$ LANGUAGE plpgsql;

-- ── Updated process_checkin: returns visit_id ────────────────────────────────
DROP FUNCTION IF EXISTS process_checkin(integer,integer,integer,numeric,numeric,integer);
CREATE OR REPLACE FUNCTION process_checkin(
  p_user_id     INTEGER,
  p_business_id INTEGER,
  p_campaign_id INTEGER,
  p_lat         DECIMAL,
  p_lng         DECIMAL,
  p_reward      INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_biz_balance  INTEGER;
  v_visits_count INTEGER;
  v_max_visits   INTEGER;
  v_visit_id     INTEGER;
BEGIN
  SELECT balance INTO v_biz_balance
    FROM businesses WHERE id = p_business_id FOR UPDATE;

  IF v_biz_balance < p_reward THEN
    RAISE EXCEPTION 'BUSINESS_INSUFFICIENT_FUNDS';
  END IF;

  SELECT visits_count, max_visits INTO v_visits_count, v_max_visits
    FROM campaigns WHERE id = p_campaign_id FOR UPDATE;

  IF v_visits_count >= v_max_visits THEN
    RAISE EXCEPTION 'NO_ACTIVE_CAMPAIGN';
  END IF;

  INSERT INTO visits (user_id, business_id, campaign_id, lat, lng, rewarded)
  VALUES (p_user_id, p_business_id, p_campaign_id, p_lat, p_lng, p_reward)
  RETURNING id INTO v_visit_id;

  UPDATE campaigns SET visits_count = visits_count + 1 WHERE id = p_campaign_id;
  UPDATE businesses SET balance = balance - p_reward WHERE id = p_business_id;

  UPDATE campaigns
     SET active = false
   WHERE business_id = p_business_id
     AND active = true
     AND reward_amount > (SELECT balance FROM businesses WHERE id = p_business_id);

  UPDATE users SET balance = balance + p_reward WHERE id = p_user_id;

  RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql;

-- ── Seed: task definitions ────────────────────────────────────────────────────
INSERT INTO task_definitions (key, type, title, geo_reward, xp_reward, requirement) VALUES
  ('daily_1_checkin',     'daily',   'Сделать 1 чекин за день',                  5,  5, '{"checkin_count": 1}'),
  ('daily_2_places',      'daily',   'Посетить 2 разных места за день',          20, 15, '{"distinct_businesses": 2}'),
  ('daily_before_noon',   'daily',   'Чекин до 12:00 (Ташкент)',                 10, 10, '{"before_noon": true}'),
  ('daily_3_checkins',    'daily',   'Сделать 3 чекина за день',                 25, 20, '{"checkin_count": 3}'),
  ('daily_new_place',     'daily',   'Посетить новое место',                     15, 10, '{"new_place": 1}'),
  ('weekly_5_places',     'weekly',  'Посетить 5 разных мест за неделю',         75, 50, '{"distinct_businesses": 5}'),
  ('weekly_streak_7',     'weekly',  'Держать стрик 7 дней подряд',             100, 30, '{"streak_days": 7}'),
  ('weekly_15_checkins',  'weekly',  'Сделать 15 чекинов за неделю',            120, 50, '{"checkin_count": 15}'),
  ('weekly_3_categories', 'weekly',  'Посетить 3 категории заведений',           50, 25, '{"distinct_categories": 3}'),
  ('onetime_first',       'onetime', 'Первый чекин',                             15, 10, '{"checkin_count": 1}'),
  ('onetime_withdrawal',  'onetime', 'Первый вывод средств',                     25, 15, '{"withdrawal_count": 1}'),
  ('onetime_referral',    'onetime', 'Первое приглашение друга',                 50, 20, '{"referral_activated": 1}')
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  geo_reward = EXCLUDED.geo_reward,
  xp_reward = EXCLUDED.xp_reward,
  requirement = EXCLUDED.requirement;

-- ── Seed: achievement definitions ────────────────────────────────────────────
INSERT INTO achievement_definitions (key, title, description, geo_reward, xp_reward, requirement) VALUES
  ('pioneer',        'Первооткрыватель', 'Побывать в 10 разных заведениях',           100,  25, '{"distinct_businesses": 10}'),
  ('unbreakable',    'Несломленный',     'Стрик 30 дней подряд',                      500, 100, '{"streak_days": 30}'),
  ('recruiter',      'Рекрутёр',         'Пригласить 5 друзей',                       300,  75, '{"referrals_activated": 5}'),
  ('early_bird',     'Ранняя пташка',    'Сделать 7 чекинов до 12:00 (Ташкент)',       80,  40, '{"early_checkins": 7}'),
  ('loyal',          'Преданный',        'Посетить одно заведение 10 раз',            100,  50, '{"same_business_visits": 10}'),
  ('legend_quarter', 'Легенда квартала', 'Попасть в топ-10 по GEO за месяц',         1000, 200, '{"monthly_top10": true}')
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  geo_reward = EXCLUDED.geo_reward,
  xp_reward = EXCLUDED.xp_reward,
  requirement = EXCLUDED.requirement;

-- ============================================================
-- Performance indexes
-- ============================================================

-- visits: most frequently queried table
CREATE INDEX IF NOT EXISTS idx_visits_user_biz     ON visits (user_id, business_id);
CREATE INDEX IF NOT EXISTS idx_visits_user_created ON visits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_biz_created  ON visits (business_id, created_at DESC);

-- businesses: every admin request filters by owner
CREATE INDEX IF NOT EXISTS idx_businesses_owner    ON businesses (owner_telegram_id);
CREATE INDEX IF NOT EXISTS idx_businesses_qr_token ON businesses (qr_token);

-- campaigns: checkin lookup by qr_token
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_qr_token ON campaigns (qr_token) WHERE qr_token IS NOT NULL;

-- withdrawals: superadmin filters by status constantly
CREATE INDEX IF NOT EXISTS idx_withdrawals_status  ON withdrawals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user    ON withdrawals (user_id, created_at DESC);

-- verification_pins: pin lookup during checkin
CREATE INDEX IF NOT EXISTS idx_pins_biz_pin        ON verification_pins (business_id, pin);

-- referral_earnings: passive income lookups
CREATE INDEX IF NOT EXISTS idx_ref_earnings_referrer ON referral_earnings (referrer_id);
CREATE INDEX IF NOT EXISTS idx_ref_earnings_referred ON referral_earnings (referred_id);

-- ============================================================
-- Support messages
-- ============================================================

CREATE TABLE IF NOT EXISTS support_messages (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL DEFAULT 'chat',   -- 'chat' | 'report'
  message     TEXT NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'open',   -- 'open' | 'replied' | 'closed'
  admin_reply TEXT,
  replied_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_user_id    ON support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_status     ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);
