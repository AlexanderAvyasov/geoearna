-- ============================================================
-- GeoEarn — ЕДИНЫЙ ДЕПЛОЙ (запускать один раз в Supabase SQL Editor)
-- Идемпотентен: безопасно запускать повторно
-- ============================================================

-- Необходимо расширение для gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. Колонки таблиц ─────────────────────────────────────────────────────────

ALTER TABLE businesses  ADD COLUMN IF NOT EXISTS owner_telegram_id BIGINT;
ALTER TABLE businesses  ADD COLUMN IF NOT EXISTS suspended_at      TIMESTAMPTZ;

ALTER TABLE campaigns   ADD COLUMN IF NOT EXISTS task_type        VARCHAR(20) NOT NULL DEFAULT 'visit';
ALTER TABLE campaigns   ADD COLUMN IF NOT EXISTS task_description TEXT;
ALTER TABLE campaigns   ADD COLUMN IF NOT EXISTS requires_pin     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE campaigns   ADD COLUMN IF NOT EXISTS budget           INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns   ADD COLUMN IF NOT EXISTS created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE campaigns   ADD COLUMN IF NOT EXISTS qr_token         VARCHAR(64) UNIQUE;

ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS note         TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS xp            INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level         SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by   INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at     TIMESTAMPTZ;

-- Backfill campaign qr_token
UPDATE campaigns SET qr_token = encode(gen_random_bytes(24), 'hex') WHERE qr_token IS NULL;

-- ── 2. Таблицы ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_wallet (
  id      INTEGER PRIMARY KEY DEFAULT 1,
  balance BIGINT  NOT NULL DEFAULT 0,
  CHECK (id = 1)
);
INSERT INTO platform_wallet (id, balance) VALUES (1, 0) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS platform_transactions (
  id          SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_pins (
  id          SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  pin         VARCHAR(6) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topup_requests (
  id           SERIAL PRIMARY KEY,
  business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE topup_requests DROP CONSTRAINT IF EXISTS topup_requests_amount_check;

CREATE TABLE IF NOT EXISTS geo_rate_history (
  id         SERIAL PRIMARY KEY,
  rate       NUMERIC  NOT NULL CHECK (rate > 0),
  admin_id   BIGINT   NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sa_audit_log (
  id         SERIAL PRIMARY KEY,
  action     TEXT    NOT NULL,
  admin_id   BIGINT,
  target_id  INTEGER,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Если таблица уже существует с NOT NULL — исправляем
ALTER TABLE sa_audit_log ALTER COLUMN admin_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak    INTEGER  NOT NULL DEFAULT 0,
  longest_streak    INTEGER  NOT NULL DEFAULT 0,
  last_checkin_date DATE,
  freeze_available  SMALLINT NOT NULL DEFAULT 0,
  freeze_used_date  DATE
);

CREATE TABLE IF NOT EXISTS xp_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_definitions (
  key         VARCHAR(50) PRIMARY KEY,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('daily','weekly','onetime')),
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

CREATE TABLE IF NOT EXISTS referrals (
  referrer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id   INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  activated     BOOLEAN NOT NULL DEFAULT false,
  activated_at  TIMESTAMPTZ,
  passive_until TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_earnings (
  id          SERIAL PRIMARY KEY,
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_id    INTEGER REFERENCES visits(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE referral_earnings ALTER COLUMN visit_id DROP NOT NULL;

-- Promo QR campaigns (location-based, rarity-tiered)
CREATE TABLE IF NOT EXISTS promo_campaigns (
  id             SERIAL PRIMARY KEY,
  token          VARCHAR(64)      NOT NULL UNIQUE,
  title          VARCHAR(255)     NOT NULL,
  description    TEXT,
  reward_amount  INT              NOT NULL DEFAULT 10 CHECK (reward_amount >= 1),
  max_claims     INT              NOT NULL DEFAULT 100 CHECK (max_claims >= 1),
  claims_count   INT              NOT NULL DEFAULT 0,
  rarity         VARCHAR(20)      NOT NULL DEFAULT 'common'
                   CHECK (rarity IN ('common','rare','epic','legendary')),
  lat            DOUBLE PRECISION NOT NULL,
  lng            DOUBLE PRECISION NOT NULL,
  radius_m       INT              NOT NULL DEFAULT 200,
  expires_at     TIMESTAMPTZ,
  cooldown_hours INT              NOT NULL DEFAULT 0,
  image_url      TEXT,
  active         BOOLEAN          NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  created_by     BIGINT
);

CREATE TABLE IF NOT EXISTS promo_claims (
  id          SERIAL PRIMARY KEY,
  promo_id    INT          NOT NULL REFERENCES promo_campaigns(id) ON DELETE CASCADE,
  user_id     INT          NOT NULL REFERENCES users(id),
  claimed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  geo_awarded INT          NOT NULL,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION
);

-- Platform channel-subscription promotions (UUID PKs)
CREATE TABLE IF NOT EXISTS platform_promotions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token            text        UNIQUE NOT NULL
                               DEFAULT 'pp_' || replace(gen_random_uuid()::text, '-', ''),
  title            text        NOT NULL,
  description      text,
  reward_amount    int         NOT NULL CHECK (reward_amount > 0),
  channel_username text        NOT NULL,
  channel_id       bigint      NOT NULL,
  max_claims       int         NOT NULL DEFAULT 10000,
  claims_count     int         NOT NULL DEFAULT 0,
  active           boolean     NOT NULL DEFAULT true,
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_promo_claims (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id    uuid        NOT NULL REFERENCES platform_promotions(id) ON DELETE CASCADE,
  user_id     integer     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_id, user_id)
);

-- GeoHunt scavenger hunt tables (UUID PKs)
CREATE TABLE IF NOT EXISTS geohunts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text        NOT NULL,
  description     text,
  reward_per_code int         NOT NULL CHECK (reward_per_code > 0),
  total_codes     int         NOT NULL DEFAULT 0,
  claimed_codes   int         NOT NULL DEFAULT 0,
  active          boolean     NOT NULL DEFAULT true,
  starts_at       timestamptz,
  ends_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS geohunt_codes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hunt_id     uuid        NOT NULL REFERENCES geohunts(id) ON DELETE CASCADE,
  token       text        UNIQUE NOT NULL
                          DEFAULT 'gh_' || replace(gen_random_uuid()::text, '-', ''),
  point_label text,
  used_by     integer     REFERENCES users(id) ON DELETE SET NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Support messages
CREATE TABLE IF NOT EXISTS support_messages (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL DEFAULT 'chat',
  message     TEXT NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'open',
  admin_reply TEXT,
  replied_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Триггер — referral_code ─────────────────────────────────────────────────

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

UPDATE users SET referral_code = 'ref_' || id WHERE referral_code IS NULL;

-- ── 4. RPC-функции ────────────────────────────────────────────────────────────

-- Атомичный чекин (возвращает visit_id)
DROP FUNCTION IF EXISTS process_checkin(INTEGER,INTEGER,INTEGER,DECIMAL,DECIMAL,INTEGER);
CREATE OR REPLACE FUNCTION process_checkin(
  p_user_id INTEGER, p_business_id INTEGER, p_campaign_id INTEGER,
  p_lat DECIMAL, p_lng DECIMAL, p_reward INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_biz_balance  INTEGER;
  v_visits_count INTEGER;
  v_max_visits   INTEGER;
  v_visit_id     INTEGER;
BEGIN
  SELECT balance INTO v_biz_balance FROM businesses WHERE id = p_business_id FOR UPDATE;
  IF v_biz_balance < p_reward THEN RAISE EXCEPTION 'BUSINESS_INSUFFICIENT_FUNDS'; END IF;
  SELECT visits_count, max_visits INTO v_visits_count, v_max_visits
    FROM campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_visits_count >= v_max_visits THEN RAISE EXCEPTION 'NO_ACTIVE_CAMPAIGN'; END IF;
  INSERT INTO visits (user_id, business_id, campaign_id, lat, lng, rewarded)
    VALUES (p_user_id, p_business_id, p_campaign_id, p_lat, p_lng, p_reward) RETURNING id INTO v_visit_id;
  UPDATE campaigns SET visits_count = visits_count + 1 WHERE id = p_campaign_id;
  UPDATE businesses SET balance = balance - p_reward WHERE id = p_business_id;
  UPDATE campaigns SET active = false
    WHERE business_id = p_business_id AND active = true
      AND reward_amount > (SELECT balance FROM businesses WHERE id = p_business_id);
  UPDATE users SET balance = balance + p_reward WHERE id = p_user_id;
  RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql;

-- Атомичный вывод
CREATE OR REPLACE FUNCTION process_withdrawal(p_user_id INTEGER, p_amount INTEGER, p_phone VARCHAR)
RETURNS TABLE(new_balance INTEGER, withdrawal_id INTEGER) AS $$
DECLARE
  v_balance     INTEGER;
  v_new_balance INTEGER;
  v_wid         INTEGER;
BEGIN
  SELECT balance INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
  v_new_balance := v_balance - p_amount;
  UPDATE users SET balance = v_new_balance WHERE id = p_user_id;
  INSERT INTO withdrawals (user_id, amount, phone, status)
    VALUES (p_user_id, p_amount, p_phone, 'pending') RETURNING id INTO v_wid;
  RETURN QUERY SELECT v_new_balance, v_wid;
END;
$$ LANGUAGE plpgsql;

-- Одобрение вывода (атомично, только статус — реальная выплата вне БД)
CREATE OR REPLACE FUNCTION approve_withdrawal(p_withdrawal_id INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE withdrawals SET status = 'approved', processed_at = NOW()
   WHERE id = p_withdrawal_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
END;
$$ LANGUAGE plpgsql;

-- Отклонение вывода (возврат GEO)
CREATE OR REPLACE FUNCTION reject_withdrawal(p_withdrawal_id INTEGER, p_note TEXT DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_user_id INTEGER;
  v_amount  INTEGER;
BEGIN
  SELECT user_id, amount INTO v_user_id, v_amount
    FROM withdrawals WHERE id = p_withdrawal_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  UPDATE withdrawals SET status = 'rejected', note = p_note, processed_at = NOW()
    WHERE id = p_withdrawal_id;
  UPDATE users SET balance = balance + v_amount WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Подтверждение топапа
CREATE OR REPLACE FUNCTION confirm_topup(p_request_id INTEGER)
RETURNS void AS $$
DECLARE
  v_amount      INTEGER;
  v_business_id INTEGER;
BEGIN
  SELECT amount, business_id INTO v_amount, v_business_id
    FROM topup_requests WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
  UPDATE topup_requests SET status = 'confirmed', processed_at = NOW() WHERE id = p_request_id;
  UPDATE businesses SET balance = balance + v_amount WHERE id = v_business_id;
END;
$$ LANGUAGE plpgsql;

-- Создание кампании (5% комиссия, атомично, с qr_token)
CREATE OR REPLACE FUNCTION create_campaign_with_commission(
  p_business_id INTEGER, p_budget INTEGER, p_reward_amount INTEGER,
  p_max_visits INTEGER, p_task_type VARCHAR, p_task_description TEXT,
  p_requires_pin BOOLEAN, p_ends_at TIMESTAMPTZ, p_qr_token VARCHAR
) RETURNS INTEGER AS $$
DECLARE
  v_biz_balance INTEGER;
  v_rewards_sum INTEGER;
  v_commission  INTEGER;
  v_total_cost  INTEGER;
  v_campaign_id INTEGER;
BEGIN
  SELECT balance INTO v_biz_balance FROM businesses WHERE id = p_business_id FOR UPDATE;
  v_rewards_sum := p_reward_amount * p_max_visits;
  v_commission  := GREATEST(CEIL(v_rewards_sum * 0.05)::INTEGER, CASE WHEN v_rewards_sum > 0 THEN 1 ELSE 0 END);
  v_total_cost  := v_rewards_sum + v_commission;
  IF v_biz_balance < v_total_cost THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  UPDATE businesses      SET balance = balance - v_commission WHERE id = p_business_id;
  UPDATE platform_wallet SET balance = balance + v_commission WHERE id = 1;
  INSERT INTO campaigns (business_id, budget, reward_amount, max_visits,
    task_type, task_description, requires_pin, ends_at, active, qr_token)
  VALUES (p_business_id, v_rewards_sum, p_reward_amount, p_max_visits,
    p_task_type, p_task_description, p_requires_pin, p_ends_at, true, p_qr_token)
  RETURNING id INTO v_campaign_id;
  INSERT INTO platform_transactions (campaign_id, business_id, amount)
    VALUES (v_campaign_id, p_business_id, v_commission);
  RETURN v_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Бонус из платформенного кошелька
CREATE OR REPLACE FUNCTION apply_checkin_bonus(p_user_id INTEGER, p_amount INTEGER)
RETURNS void AS $$
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

-- XP + уровень
CREATE OR REPLACE FUNCTION grant_xp(p_user_id INTEGER, p_amount INTEGER, p_reason TEXT)
RETURNS TABLE(new_xp INTEGER, new_level SMALLINT, leveled_up BOOLEAN) AS $$
DECLARE
  v_old_xp    INTEGER;
  v_new_xp    INTEGER;
  v_old_level SMALLINT;
  v_new_level SMALLINT;
BEGIN
  SELECT xp, level INTO v_old_xp, v_old_level FROM users WHERE id = p_user_id FOR UPDATE;
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

-- Активация реферала (идемпотентна)
CREATE OR REPLACE FUNCTION activate_referral(p_referred_id INTEGER)
RETURNS BOOLEAN AS $$
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

-- Пассивный доход реферера 5% на 30 дней (идемпотентна)
CREATE OR REPLACE FUNCTION process_referral_income(
  p_referred_id INTEGER, p_visit_id INTEGER, p_reward INTEGER
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

-- Счётчик использованных кодов GeoHunt
CREATE OR REPLACE FUNCTION increment_geohunt_claimed(p_hunt_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE geohunts SET claimed_codes = claimed_codes + 1 WHERE id = p_hunt_id;
END;
$$;

-- ── 5. Индексы ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_visits_user_biz       ON visits (user_id, business_id);
CREATE INDEX IF NOT EXISTS idx_visits_user_created   ON visits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_biz_created    ON visits (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_owner      ON businesses (owner_telegram_id);
CREATE INDEX IF NOT EXISTS idx_businesses_qr_token   ON businesses (qr_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_qr_token ON campaigns (qr_token) WHERE qr_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_withdrawals_status    ON withdrawals (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user      ON withdrawals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pins_biz_pin          ON verification_pins (business_id, pin);
CREATE INDEX IF NOT EXISTS idx_ref_earnings_referrer ON referral_earnings (referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ref_earnings_referred ON referral_earnings (referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer    ON referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_xp_log_user           ON xp_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geo_rate_history_ts   ON geo_rate_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_audit_log_ts       ON sa_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_audit_log_action   ON sa_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_sa_audit_log_target   ON sa_audit_log (target_id) WHERE target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promo_campaigns_token ON promo_campaigns (token);
CREATE INDEX IF NOT EXISTS idx_promo_campaigns_active ON promo_campaigns (active);
CREATE INDEX IF NOT EXISTS idx_promo_claims_promo    ON promo_claims (promo_id, user_id);
CREATE INDEX IF NOT EXISTS idx_promo_claims_user_day ON promo_claims (user_id, claimed_at);
CREATE INDEX IF NOT EXISTS idx_pp_token              ON platform_promotions (token);
CREATE INDEX IF NOT EXISTS idx_pp_active             ON platform_promotions (active);
CREATE INDEX IF NOT EXISTS idx_ppc_promo             ON platform_promo_claims (promo_id);
CREATE INDEX IF NOT EXISTS idx_ppc_user              ON platform_promo_claims (user_id);
CREATE INDEX IF NOT EXISTS idx_gh_active             ON geohunts (active);
CREATE INDEX IF NOT EXISTS idx_ghc_hunt              ON geohunt_codes (hunt_id);
CREATE INDEX IF NOT EXISTS idx_ghc_token             ON geohunt_codes (token);
CREATE INDEX IF NOT EXISTS idx_ghc_used_by           ON geohunt_codes (used_by);
CREATE INDEX IF NOT EXISTS idx_support_user          ON support_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_support_status        ON support_messages (status);
CREATE INDEX IF NOT EXISTS idx_support_created       ON support_messages (created_at DESC);

-- ── 6. Seed данные ────────────────────────────────────────────────────────────

INSERT INTO task_definitions (key, type, title, geo_reward, xp_reward, requirement) VALUES
  ('daily_1_checkin',     'daily',   'Сделать 1 чекин за день',               5,  5,  '{"checkin_count": 1}'),
  ('daily_2_places',      'daily',   'Посетить 2 разных места за день',       20, 15,  '{"distinct_businesses": 2}'),
  ('daily_before_noon',   'daily',   'Чекин до 12:00 (Ташкент)',              10, 10,  '{"before_noon": true}'),
  ('daily_3_checkins',    'daily',   'Сделать 3 чекина за день',              25, 20,  '{"checkin_count": 3}'),
  ('daily_new_place',     'daily',   'Посетить новое место',                  15, 10,  '{"new_place": 1}'),
  ('weekly_5_places',     'weekly',  'Посетить 5 разных мест за неделю',      75, 50,  '{"distinct_businesses": 5}'),
  ('weekly_streak_7',     'weekly',  'Держать стрик 7 дней подряд',          100, 30,  '{"streak_days": 7}'),
  ('weekly_15_checkins',  'weekly',  'Сделать 15 чекинов за неделю',         120, 50,  '{"checkin_count": 15}'),
  ('weekly_3_categories', 'weekly',  'Посетить 3 категории заведений',        50, 25,  '{"distinct_categories": 3}'),
  ('onetime_first',       'onetime', 'Первый чекин',                          15, 10,  '{"checkin_count": 1}'),
  ('onetime_withdrawal',  'onetime', 'Первый вывод средств',                  25, 15,  '{"withdrawal_count": 1}'),
  ('onetime_referral',    'onetime', 'Первое приглашение друга',              50, 20,  '{"referral_activated": 1}')
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title, geo_reward = EXCLUDED.geo_reward,
  xp_reward = EXCLUDED.xp_reward, requirement = EXCLUDED.requirement;

INSERT INTO achievement_definitions (key, title, description, geo_reward, xp_reward, requirement) VALUES
  ('pioneer',        'Первооткрыватель', 'Побывать в 10 разных заведениях',         100,  25, '{"distinct_businesses": 10}'),
  ('unbreakable',    'Несломленный',     'Стрик 30 дней подряд',                    500, 100, '{"streak_days": 30}'),
  ('recruiter',      'Рекрутёр',         'Пригласить 5 друзей',                     300,  75, '{"referrals_activated": 5}'),
  ('early_bird',     'Ранняя пташка',    'Сделать 7 чекинов до 12:00 (Ташкент)',     80,  40, '{"early_checkins": 7}'),
  ('loyal',          'Преданный',        'Посетить одно заведение 10 раз',          100,  50, '{"same_business_visits": 10}'),
  ('legend_quarter', 'Легенда квартала', 'Попасть в топ-10 по GEO за месяц',       1000, 200, '{"monthly_top10": true}')
ON CONFLICT (key) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description,
  geo_reward = EXCLUDED.geo_reward, xp_reward = EXCLUDED.xp_reward,
  requirement = EXCLUDED.requirement;

-- ── Финальная проверка ────────────────────────────────────────────────────────
SELECT expected_table,
       CASE WHEN t.table_name IS NOT NULL THEN 'OK' ELSE 'MISSING — migration failed!' END AS status
FROM (VALUES
  ('users'),('businesses'),('campaigns'),('visits'),('withdrawals'),
  ('verification_pins'),('topup_requests'),('platform_wallet'),('platform_transactions'),
  ('geo_rate_history'),('sa_audit_log'),('user_streaks'),('xp_log'),
  ('task_definitions'),('user_tasks'),('achievement_definitions'),('user_achievements'),
  ('referrals'),('referral_earnings'),('boosts'),
  ('promo_campaigns'),('promo_claims'),
  ('platform_promotions'),('platform_promo_claims'),
  ('geohunts'),('geohunt_codes'),('support_messages')
) AS e(expected_table)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = e.expected_table
ORDER BY expected_table;
