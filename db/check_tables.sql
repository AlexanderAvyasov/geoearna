-- ============================================================
-- GeoEarn — Диагностика всех таблиц
-- Запускать в Supabase SQL Editor (Settings → SQL Editor)
-- ============================================================

-- ── 1. Проверка существования таблиц ─────────────────────────────────────────
SELECT
  table_name,
  CASE WHEN table_name IN (
    'users','businesses','campaigns','visits','withdrawals',
    'verification_pins','topup_requests','platform_wallet',
    'platform_transactions','geo_rate_history','sa_audit_log',
    'user_streaks','xp_log','task_definitions','user_tasks',
    'achievement_definitions','user_achievements',
    'referrals','referral_earnings','boosts',
    'promo_campaigns','promo_claims'
  ) THEN '✅ ожидается' ELSE '⚠️ лишняя' END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type   = 'BASE TABLE'
ORDER BY table_name;


-- ── 2. Количество строк в каждой таблице ─────────────────────────────────────
SELECT 'users'                AS table_name, COUNT(*) AS rows FROM users
UNION ALL
SELECT 'businesses',                         COUNT(*)         FROM businesses
UNION ALL
SELECT 'campaigns',                          COUNT(*)         FROM campaigns
UNION ALL
SELECT 'visits',                             COUNT(*)         FROM visits
UNION ALL
SELECT 'withdrawals',                        COUNT(*)         FROM withdrawals
UNION ALL
SELECT 'verification_pins',                  COUNT(*)         FROM verification_pins
UNION ALL
SELECT 'topup_requests',                     COUNT(*)         FROM topup_requests
UNION ALL
SELECT 'platform_transactions',              COUNT(*)         FROM platform_transactions
UNION ALL
SELECT 'geo_rate_history',                   COUNT(*)         FROM geo_rate_history
UNION ALL
SELECT 'sa_audit_log',                       COUNT(*)         FROM sa_audit_log
UNION ALL
SELECT 'user_streaks',                       COUNT(*)         FROM user_streaks
UNION ALL
SELECT 'xp_log',                             COUNT(*)         FROM xp_log
UNION ALL
SELECT 'task_definitions',                   COUNT(*)         FROM task_definitions
UNION ALL
SELECT 'user_tasks',                         COUNT(*)         FROM user_tasks
UNION ALL
SELECT 'achievement_definitions',            COUNT(*)         FROM achievement_definitions
UNION ALL
SELECT 'user_achievements',                  COUNT(*)         FROM user_achievements
UNION ALL
SELECT 'referrals',                          COUNT(*)         FROM referrals
UNION ALL
SELECT 'referral_earnings',                  COUNT(*)         FROM referral_earnings
UNION ALL
SELECT 'boosts',                             COUNT(*)         FROM boosts
UNION ALL
SELECT 'promo_campaigns',                    COUNT(*)         FROM promo_campaigns
UNION ALL
SELECT 'promo_claims',                       COUNT(*)         FROM promo_claims
ORDER BY table_name;


-- ── 3. Проверка платформенного кошелька ──────────────────────────────────────
SELECT
  id,
  balance,
  CASE WHEN balance < 0 THEN '🔴 ОТРИЦАТЕЛЬНЫЙ — ОШИБКА'
       WHEN balance = 0 THEN '🟡 пустой'
       ELSE '✅ ' || balance::TEXT || ' GEO'
  END AS status
FROM platform_wallet;


-- ── 4. Статус кампаний ───────────────────────────────────────────────────────
SELECT
  COUNT(*)                                              AS total,
  COUNT(*) FILTER (WHERE active = true)                 AS active,
  COUNT(*) FILTER (WHERE active = false)                AS stopped,
  COUNT(*) FILTER (WHERE visits_count >= max_visits)    AS exhausted,
  COUNT(*) FILTER (WHERE ends_at IS NOT NULL AND ends_at <= NOW()) AS expired,
  SUM(budget)                                           AS total_budget_geo,
  SUM(visits_count * reward_amount)                     AS total_paid_geo
FROM campaigns;


-- ── 5. Статус выводов (withdrawals) ─────────────────────────────────────────
SELECT
  status,
  COUNT(*)        AS count,
  SUM(amount)     AS total_geo
FROM withdrawals
GROUP BY status
ORDER BY status;


-- ── 6. Статус топап-заявок ───────────────────────────────────────────────────
SELECT
  status,
  COUNT(*)        AS count,
  SUM(amount)     AS total_geo
FROM topup_requests
GROUP BY status
ORDER BY status;


-- ── 7. Топ-10 пользователей по балансу ───────────────────────────────────────
SELECT
  id,
  telegram_id,
  username,
  balance,
  xp,
  level,
  banned_at IS NOT NULL AS is_banned,
  created_at::DATE      AS joined
FROM users
ORDER BY balance DESC
LIMIT 10;


-- ── 8. Топ-10 бизнесов по балансу ────────────────────────────────────────────
SELECT
  b.id,
  b.name,
  b.balance,
  b.owner_telegram_id,
  b.suspended_at IS NOT NULL AS is_suspended,
  COUNT(c.id)                AS campaigns_total,
  COUNT(c.id) FILTER (WHERE c.active) AS campaigns_active
FROM businesses b
LEFT JOIN campaigns c ON c.business_id = b.id
GROUP BY b.id
ORDER BY b.balance DESC
LIMIT 10;


-- ── 9. Проверка nullable visit_id в referral_earnings (BUG-02) ───────────────
SELECT
  column_name,
  is_nullable,
  CASE WHEN is_nullable = 'YES' THEN '✅ nullable — OK'
       ELSE '🔴 NOT NULL — BUG-02 не исправлен, запусти MIGRATION 001'
  END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'referral_earnings'
  AND column_name  = 'visit_id';


-- ── 10. Проверка constraint на topup_requests.amount (BUG топап) ─────────────
SELECT
  constraint_name,
  check_clause,
  '🔴 constraint существует — запусти MIGRATION 002' AS status
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name LIKE '%topup_requests%amount%'
UNION ALL
SELECT
  '(нет constraint на amount)' AS constraint_name,
  NULL,
  '✅ OK — ограничение удалено'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
  WHERE constraint_schema = 'public'
    AND constraint_name LIKE '%topup_requests%amount%'
);


-- ── 11. Проверка наличия promo-таблиц (MIGRATION 003) ────────────────────────
SELECT
  t.expected_table,
  CASE WHEN i.table_name IS NOT NULL THEN '✅ существует'
       ELSE '🔴 НЕ СОЗДАНА — запусти MIGRATION 003'
  END AS status
FROM (
  VALUES ('promo_campaigns'), ('promo_claims')
) AS t(expected_table)
LEFT JOIN information_schema.tables i
  ON i.table_schema = 'public'
 AND i.table_name   = t.expected_table;


-- ── 12. Проверка RPC-функций ──────────────────────────────────────────────────
SELECT
  routine_name,
  '✅ существует' AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type   = 'FUNCTION'
  AND routine_name IN (
    'process_checkin',
    'process_withdrawal',
    'confirm_topup',
    'reject_withdrawal',
    'create_campaign_with_commission',
    'apply_checkin_bonus',
    'grant_xp',
    'activate_referral',
    'process_referral_income',
    'trg_set_referral_code'
  )
ORDER BY routine_name;


-- ── 13. Проверка индексов ─────────────────────────────────────────────────────
SELECT
  indexname,
  tablename,
  '✅' AS exists
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_geo_rate_history_created_at',
    'idx_sa_audit_log_created_at',
    'idx_sa_audit_log_action',
    'idx_sa_audit_log_target_id',
    'idx_xp_log_user',
    'idx_referrals_referrer',
    'idx_ref_earnings_referrer',
    'idx_promo_campaigns_token',
    'idx_promo_campaigns_active',
    'idx_promo_claims_promo_user',
    'idx_promo_claims_user_day'
  )
ORDER BY indexname;


-- ── 14. Активность за последние 24 часа ──────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM visits      WHERE created_at > NOW() - INTERVAL '24h') AS visits_24h,
  (SELECT COUNT(*) FROM withdrawals WHERE created_at > NOW() - INTERVAL '24h') AS withdrawals_24h,
  (SELECT COUNT(*) FROM users       WHERE created_at > NOW() - INTERVAL '24h') AS new_users_24h,
  (SELECT COUNT(*) FROM promo_claims WHERE claimed_at > NOW() - INTERVAL '24h')
    AS promo_claims_24h;


-- ── 15. Сверка балансов (консистентность данных) ─────────────────────────────
-- Суммарный баланс всех пользователей vs суммарно выданный GEO
SELECT
  (SELECT COALESCE(SUM(balance),0) FROM users)                           AS total_user_balances,
  (SELECT COALESCE(SUM(rewarded),0) FROM visits)                         AS total_geo_via_checkins,
  (SELECT COALESCE(SUM(amount),0) FROM referral_earnings)                AS total_geo_via_referrals,
  (SELECT COALESCE(SUM(geo_awarded),0) FROM promo_claims)                AS total_geo_via_promo,
  (SELECT COALESCE(SUM(amount),0)
     FROM withdrawals WHERE status IN ('pending','approved'))             AS total_geo_in_withdrawals,
  (SELECT balance FROM platform_wallet)                                   AS platform_wallet_balance;
