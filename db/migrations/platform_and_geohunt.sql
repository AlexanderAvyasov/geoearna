-- Migration: Platform Promotions + GeoHunt
-- Run once against your Supabase project

-- ─── Platform Promotions ──────────────────────────────────────────────────────
-- Channel-subscription promotions shown on the home screen.
-- Users must subscribe to a Telegram channel to claim the reward.

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

CREATE INDEX IF NOT EXISTS idx_pp_token  ON platform_promotions (token);
CREATE INDEX IF NOT EXISTS idx_pp_active ON platform_promotions (active);

-- ─── Platform Promo Claims ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_promo_claims (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id    uuid        NOT NULL REFERENCES platform_promotions(id) ON DELETE CASCADE,
  user_id     integer     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ppc_promo ON platform_promo_claims (promo_id);
CREATE INDEX IF NOT EXISTS idx_ppc_user  ON platform_promo_claims (user_id);

-- ─── GeoHunts ─────────────────────────────────────────────────────────────────
-- Multi-point QR scavenger hunts. Each hunt has N one-time-use codes.

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

CREATE INDEX IF NOT EXISTS idx_gh_active ON geohunts (active);

-- ─── GeoHunt Codes ────────────────────────────────────────────────────────────
-- Each row is one physical QR code in a hunt.
-- token is DB-generated so bulk inserts only need hunt_id.

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

CREATE INDEX IF NOT EXISTS idx_ghc_hunt    ON geohunt_codes (hunt_id);
CREATE INDEX IF NOT EXISTS idx_ghc_token   ON geohunt_codes (token);
CREATE INDEX IF NOT EXISTS idx_ghc_used_by ON geohunt_codes (used_by);

-- ─── Helper function: increment claimed_codes counter ─────────────────────────

CREATE OR REPLACE FUNCTION increment_geohunt_claimed(p_hunt_id uuid)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE geohunts SET claimed_codes = claimed_codes + 1 WHERE id = p_hunt_id;
END;
$$;
