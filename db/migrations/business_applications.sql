-- Migration: Business Applications (onboarding with SA approval)
-- Run once against your Supabase project

-- ─── Business Applications ────────────────────────────────────────────────────
-- Users submit an application to become a business owner.
-- SuperAdmin reviews and approves/rejects. On approval a businesses row is
-- created automatically and the user gains the business-owner role (implicit:
-- having a row in businesses with their owner_telegram_id).

CREATE TABLE IF NOT EXISTS business_applications (
  id                  SERIAL PRIMARY KEY,
  owner_telegram_id   BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  address             TEXT,
  lat                 DECIMAL(9,6),
  lng                 DECIMAL(9,6),
  category            TEXT,
  contact_phone       VARCHAR(20),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected')),
  review_note         TEXT,
  reviewed_by         BIGINT,   -- SuperAdmin telegram_id
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at         TIMESTAMPTZ
);

-- One active pending application per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_app_one_pending
  ON business_applications (owner_telegram_id)
  WHERE status = 'pending';

-- Fast SA dashboard lookup
CREATE INDEX IF NOT EXISTS idx_biz_app_status
  ON business_applications (status, created_at DESC);

-- ─── RPC: approve_business_application ───────────────────────────────────────
-- Atomically: marks application approved + creates the businesses row.
-- Called by the SuperAdmin approve endpoint.

CREATE OR REPLACE FUNCTION approve_business_application(
  p_app_id      INT,
  p_reviewer_id BIGINT
)
RETURNS businesses
LANGUAGE plpgsql
AS $$
DECLARE
  v_app  business_applications%ROWTYPE;
  v_biz  businesses%ROWTYPE;
  v_token TEXT;
BEGIN
  -- Lock & fetch application
  SELECT * INTO v_app
  FROM business_applications
  WHERE id = p_app_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND_OR_NOT_PENDING';
  END IF;

  -- Ensure user doesn't already own a business
  IF EXISTS (
    SELECT 1 FROM businesses WHERE owner_telegram_id = v_app.owner_telegram_id
  ) THEN
    RAISE EXCEPTION 'USER_ALREADY_HAS_BUSINESS';
  END IF;

  -- Generate unique QR token
  v_token := 'biz_' || replace(gen_random_uuid()::text, '-', '');

  -- Create the business
  INSERT INTO businesses (
    name, address, lat, lng,
    owner_telegram_id, qr_token,
    balance, created_at
  )
  VALUES (
    v_app.name,
    v_app.address,
    COALESCE(v_app.lat, 0),
    COALESCE(v_app.lng, 0),
    v_app.owner_telegram_id,
    v_token,
    0,
    NOW()
  )
  RETURNING * INTO v_biz;

  -- Mark application approved
  UPDATE business_applications
  SET
    status      = 'approved',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW()
  WHERE id = p_app_id;

  RETURN v_biz;
END;
$$;
