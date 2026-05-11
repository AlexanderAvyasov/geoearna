-- Migration: Promo QR Campaigns
-- Run once against your Supabase project

-- ─── Promo Campaigns ──────────────────────────────────────────────────────────
-- Location-based, rarity-tiered QR-code campaigns.
-- Each campaign has a physical QR code placed at a lat/lng location.
-- Users must be within radius_m metres to claim.

CREATE TABLE IF NOT EXISTS promo_campaigns (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token           text        UNIQUE NOT NULL,
  title           text        NOT NULL,
  description     text,
  reward_amount   int         NOT NULL CHECK (reward_amount > 0),
  max_claims      int         NOT NULL DEFAULT 100,
  claims_count    int         NOT NULL DEFAULT 0,
  rarity          text        NOT NULL DEFAULT 'common'
                              CHECK (rarity IN ('common','rare','epic','legendary')),
  lat             numeric(10,6) NOT NULL,
  lng             numeric(10,6) NOT NULL,
  radius_m        int         NOT NULL DEFAULT 200,
  expires_at      timestamptz,
  cooldown_hours  int         NOT NULL DEFAULT 0,
  image_url       text,
  active          boolean     NOT NULL DEFAULT true,
  created_by      bigint,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pc_token  ON promo_campaigns (token);
CREATE INDEX IF NOT EXISTS idx_pc_active ON promo_campaigns (active);

-- ─── Promo Claims ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS promo_claims (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id    uuid        NOT NULL REFERENCES promo_campaigns(id) ON DELETE CASCADE,
  user_id     integer     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at  timestamptz NOT NULL DEFAULT now(),
  geo_awarded int         NOT NULL DEFAULT 0,
  lat         numeric(10,6),
  lng         numeric(10,6)
);

CREATE INDEX IF NOT EXISTS idx_pcl_promo ON promo_claims (promo_id);
CREATE INDEX IF NOT EXISTS idx_pcl_user  ON promo_claims (user_id);
CREATE INDEX IF NOT EXISTS idx_pcl_date  ON promo_claims (claimed_at);
