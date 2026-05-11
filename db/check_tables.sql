-- ============================================================
-- GeoEarn — Диагностика ВСЕХ таблиц
-- Запускать в Supabase SQL Editor (Settings → SQL Editor)
-- Запускай каждый блок отдельно или весь файл целиком
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- БЛОК 1: Какие таблицы существуют (ожидается vs. лишние)
-- ═══════════════════════════════════════════════════════════
SELECT
  table_name,
  CASE WHEN table_name IN (
    'users','businesses','campaigns','visits','withdrawals',
    'verification_pins','topup_requests','platform_wallet',
    'platform_transactions','geo_rate_history','sa_audit_log',
    'user_streaks','xp_log','task_definitions','user_tasks',
    'achievement_definitions','user_achievements',
    'referrals','referral_earnings','boosts',
    'promo_campaigns','promo_claims',
    'platform_promotions','platform_promo_claims',
    'geohunts','geohunt_codes'
  ) THEN '✅ ожидается' ELSE '⚠️ лишняя' END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type   = 'BASE TABLE'
ORDER BY table_name;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 2: Проверка каждой таблицы по отдельности (EXISTS)
-- ═══════════════════════════════════════════════════════════
SELECT expected_table,
       CASE WHEN t.table_name IS NOT NULL THEN '✅ ЕСТЬ'
            ELSE '🔴 НЕТ — нужна миграция!'
       END AS status
FROM (VALUES
  ('users'),('businesses'),('campaigns'),('visits'),
  ('withdrawals'),('verification_pins'),('topup_requests'),
  ('platform_wallet'),('platform_transactions'),
  ('geo_rate_history'),('sa_audit_log'),
  ('user_streaks'),('xp_log'),
  ('task_definitions'),('user_tasks'),
  ('achievement_definitions'),('user_achievements'),
  ('referrals'),('referral_earnings'),('boosts'),
  ('promo_campaigns'),('promo_claims'),
  ('platform_promotions'),('platform_promo_claims'),
  ('geohunts'),('geohunt_codes')
) AS e(expected_table)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = e.expected_table
ORDER BY expected_table;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 3: Количество строк во всех таблицах
-- ═══════════════════════════════════════════════════════════
SELECT 'users'                   AS t, COUNT(*) AS rows FROM users
UNION ALL SELECT 'businesses',          COUNT(*) FROM businesses
UNION ALL SELECT 'campaigns',           COUNT(*) FROM campaigns
UNION ALL SELECT 'visits',              COUNT(*) FROM visits
UNION ALL SELECT 'withdrawals',         COUNT(*) FROM withdrawals
UNION ALL SELECT 'verification_pins',   COUNT(*) FROM verification_pins
UNION ALL SELECT 'topup_requests',      COUNT(*) FROM topup_requests
UNION ALL SELECT 'platform_wallet',     COUNT(*) FROM platform_wallet
UNION ALL SELECT 'platform_transactions', COUNT(*) FROM platform_transactions
UNION ALL SELECT 'geo_rate_history',    COUNT(*) FROM geo_rate_history
UNION ALL SELECT 'sa_audit_log',        COUNT(*) FROM sa_audit_log
UNION ALL SELECT 'user_streaks',        COUNT(*) FROM user_streaks
UNION ALL SELECT 'xp_log',             COUNT(*) FROM xp_log
UNION ALL SELECT 'task_definitions',    COUNT(*) FROM task_definitions
UNION ALL SELECT 'user_tasks',          COUNT(*) FROM user_tasks
UNION ALL SELECT 'achievement_definitions', COUNT(*) FROM achievement_definitions
UNION ALL SELECT 'user_achievements',   COUNT(*) FROM user_achievements
UNION ALL SELECT 'referrals',           COUNT(*) FROM referrals
UNION ALL SELECT 'referral_earnings',   COUNT(*) FROM referral_earnings
UNION ALL SELECT 'boosts',              COUNT(*) FROM boosts
UNION ALL SELECT 'promo_campaigns',     COUNT(*) FROM promo_campaigns
UNION ALL SELECT 'promo_claims',        COUNT(*) FROM promo_claims
UNION ALL SELECT 'platform_promotions', COUNT(*) FROM platform_promotions
UNION ALL SELECT 'platform_promo_claims', COUNT(*) FROM platform_promo_claims
UNION ALL SELECT 'geohunts',            COUNT(*) FROM geohunts
UNION ALL SELECT 'geohunt_codes',       COUNT(*) FROM geohunt_codes
ORDER BY t;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 4: Проверка RPC-функций
-- ═══════════════════════════════════════════════════════════
SELECT
  e.fn AS function_name,
  CASE WHEN r.routine_name IS NOT NULL THEN '✅ ЕСТЬ'
       ELSE '🔴 НЕТ — нужна миграция!'
  END AS status
FROM (VALUES
  ('process_checkin'),
  ('process_withdrawal'),
  ('confirm_topup'),
  ('reject_withdrawal'),
  ('create_campaign_with_commission'),
  ('apply_checkin_bonus'),
  ('grant_xp'),
  ('activate_referral'),
  ('process_referral_income'),
  ('trg_set_referral_code'),
  ('increment_geohunt_claimed')
) AS e(fn)
LEFT JOIN information_schema.routines r
  ON r.routine_schema = 'public' AND r.routine_name = e.fn
ORDER BY e.fn;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 5: Платформенный кошелёк
-- ═══════════════════════════════════════════════════════════
SELECT id, balance,
  CASE WHEN balance < 0 THEN '🔴 ОТРИЦАТЕЛЬНЫЙ — ОШИБКА'
       WHEN balance = 0 THEN '🟡 пустой (пополни перед запуском GeoHunt)'
       ELSE '✅ ' || balance || ' GEO'
  END AS status
FROM platform_wallet;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 6: Активные кампании бизнеса
-- ═══════════════════════════════════════════════════════════
SELECT
  COUNT(*)                                               AS total,
  COUNT(*) FILTER (WHERE active = true)                  AS active,
  COUNT(*) FILTER (WHERE active = false)                 AS stopped,
  COUNT(*) FILTER (WHERE visits_count >= max_visits)     AS exhausted,
  COUNT(*) FILTER (WHERE ends_at IS NOT NULL AND ends_at <= NOW()) AS expired
FROM campaigns;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 7: GeoHunt — статус охот и кодов
-- ═══════════════════════════════════════════════════════════
SELECT
  h.id,
  h.title,
  h.active,
  h.reward_per_code,
  h.total_codes,
  h.claimed_codes,
  h.total_codes - h.claimed_codes     AS remaining,
  h.starts_at,
  h.ends_at,
  CASE
    WHEN NOT h.active THEN '⏸ неактивна'
    WHEN h.ends_at IS NOT NULL AND h.ends_at < NOW() THEN '⌛ истекла'
    WHEN h.starts_at IS NOT NULL AND h.starts_at > NOW() THEN '🕐 не началась'
    WHEN h.claimed_codes >= h.total_codes THEN '✅ все коды использованы'
    ELSE '🟢 активна'
  END AS status
FROM geohunts h
ORDER BY h.created_at DESC;

-- Детали кодов по каждой охоте
SELECT
  gc.hunt_id,
  gh.title,
  COUNT(*)                                      AS total_codes,
  COUNT(*) FILTER (WHERE gc.used_by IS NULL)    AS free_codes,
  COUNT(*) FILTER (WHERE gc.used_by IS NOT NULL) AS used_codes
FROM geohunt_codes gc
JOIN geohunts gh ON gh.id = gc.hunt_id
GROUP BY gc.hunt_id, gh.title
ORDER BY gh.title;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 8: Platform Promotions (подписки на каналы)
-- ═══════════════════════════════════════════════════════════
SELECT
  id,
  title,
  channel_username,
  reward_amount,
  claims_count,
  max_claims,
  active,
  starts_at,
  ends_at,
  CASE
    WHEN NOT active THEN '⏸ неактивна'
    WHEN ends_at IS NOT NULL AND ends_at < NOW() THEN '⌛ истекла'
    WHEN claims_count >= max_claims THEN '✅ лимит исчерпан'
    ELSE '🟢 активна'
  END AS status
FROM platform_promotions
ORDER BY created_at DESC;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 9: Promo QR кампании (location-based rarity)
-- ═══════════════════════════════════════════════════════════
SELECT
  id,
  title,
  rarity,
  reward_amount,
  claims_count,
  max_claims,
  active,
  expires_at,
  CASE
    WHEN NOT active THEN '⏸ неактивна'
    WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN '⌛ истекла'
    WHEN claims_count >= max_claims THEN '✅ лимит исчерпан'
    ELSE '🟢 активна'
  END AS status
FROM promo_campaigns
ORDER BY created_at DESC;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 10: Статус выводов
-- ═══════════════════════════════════════════════════════════
SELECT status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total_geo
FROM withdrawals
GROUP BY status ORDER BY status;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 11: Топ-10 пользователей по балансу
-- ═══════════════════════════════════════════════════════════
SELECT id, telegram_id, username, balance, xp, level,
  banned_at IS NOT NULL AS is_banned,
  created_at::DATE      AS joined
FROM users
ORDER BY balance DESC LIMIT 10;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 12: Активность за 24 часа
-- ═══════════════════════════════════════════════════════════
SELECT
  (SELECT COUNT(*) FROM visits         WHERE created_at > NOW()-INTERVAL '24h') AS checkins_24h,
  (SELECT COUNT(*) FROM withdrawals    WHERE created_at > NOW()-INTERVAL '24h') AS withdrawals_24h,
  (SELECT COUNT(*) FROM users          WHERE created_at > NOW()-INTERVAL '24h') AS new_users_24h,
  (SELECT COUNT(*) FROM promo_claims   WHERE claimed_at > NOW()-INTERVAL '24h') AS promo_claims_24h,
  (SELECT COUNT(*) FROM geohunt_codes  WHERE used_at    > NOW()-INTERVAL '24h') AS geohunt_scans_24h,
  (SELECT COUNT(*) FROM platform_promo_claims WHERE claimed_at > NOW()-INTERVAL '24h') AS pp_claims_24h;


-- ═══════════════════════════════════════════════════════════
-- БЛОК 13: Проверка campaigns.qr_token (нужен для checkin/info)
-- ═══════════════════════════════════════════════════════════
SELECT column_name, data_type, is_nullable,
  '✅ колонка есть' AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'campaigns'
  AND column_name  = 'qr_token'
UNION ALL
SELECT '(qr_token)', NULL, NULL,
  '🔴 КОЛОНКА ОТСУТСТВУЕТ — добавь: ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS qr_token text UNIQUE;'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='campaigns' AND column_name='qr_token'
);
