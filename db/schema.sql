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

-- Atomic checkin: inserts visit, increments campaign counter, adjusts balances
CREATE OR REPLACE FUNCTION process_checkin(
  p_user_id     INTEGER,
  p_business_id INTEGER,
  p_campaign_id INTEGER,
  p_lat         DECIMAL,
  p_lng         DECIMAL,
  p_reward      INTEGER
) RETURNS void AS $$
BEGIN
  INSERT INTO visits (user_id, business_id, campaign_id, lat, lng, rewarded)
  VALUES (p_user_id, p_business_id, p_campaign_id, p_lat, p_lng, p_reward);

  UPDATE campaigns
     SET visits_count = visits_count + 1
   WHERE id = p_campaign_id;

  UPDATE businesses
     SET balance = balance - p_reward
   WHERE id = p_business_id;

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
