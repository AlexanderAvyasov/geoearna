-- Migration: TOS Acceptances — consent audit log
-- Run once against your Supabase project

CREATE TABLE IF NOT EXISTS tos_acceptances (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  telegram_id        BIGINT,
  tos_version        TEXT NOT NULL DEFAULT 'v1',
  device_fingerprint TEXT,          -- SHA-256 of UA + screen + TG platform signals
  user_agent         TEXT,
  tg_platform        TEXT,          -- Telegram.WebApp.platform
  tg_version         TEXT,          -- Telegram.WebApp.version
  ip                 TEXT,          -- server-side, from request
  accepted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tos_telegram_id ON tos_acceptances (telegram_id);
CREATE INDEX IF NOT EXISTS idx_tos_accepted_at ON tos_acceptances (accepted_at DESC);
