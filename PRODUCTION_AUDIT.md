# GeoEarn — Production Readiness Audit
**Date:** 2026-05-14  
**Status: 🟡 ПОЧТИ ГОТОВО — запустить deploy.sql + пополнить platform_wallet**

---

## Verdict Summary

| Area | Status | Что сделано |
|------|--------|-------------|
| Database / Migrations | 🟡 PENDING SQL | Создан `db/deploy.sql` — запустить один раз |
| API Security | ✅ SOLID | — |
| Business Logic | ✅ FIXED | console.log убраны, admin_id null исправлен |
| Frontend | ✅ FIXED | console.log убраны во всех продакшн-путях |
| Environment / Config | 🟡 WARNING | Нужны env vars + пополнить platform_wallet |
| Infrastructure | ✅ SOLID | — |

---

## ✅ ИСПРАВЛЕНО (код)

### C1. `create_campaign_with_commission` — 9 параметров

**Файл:** `api/routes/admin.js` строка 148  
**Было:** функция в БД принимала 8 параметров, код передавал 9 (`p_qr_token`).  
**Исправление:** `db/deploy.sql` содержит правильную 9-параметровую версию.

---

### C2 + C3 + C4. Отсутствующие таблицы и функции

**Таблицы:** `promo_campaigns`, `promo_claims`, `geohunts`, `geohunt_codes`, `platform_promotions`, `platform_promo_claims`  
**Функция:** `approve_withdrawal`  
**Исправление:** Все определены в `db/deploy.sql`.

---

### W1 + W2. `console.log` в продакшн-сборке

**Файлы:** `miniapp/src/pages/Checkin.jsx`, `miniapp/src/App.jsx`  
**Было:** 22 + 18 вызовов в production bundle (GPS, токены, PIN-попытки).  
**Исправление:** Все заменены на `clog`/`cwarn`/`cerr` — no-op в PROD, активны только в DEV.

---

### W3. `sa_audit_log.admin_id: null` — нарушение NOT NULL

**Файл:** `api/routes/promo.js` строка 163  
**Было:** `admin_id: null` в NOT NULL колонку → INSERT падал тихо, аудит не писался.  
**Исправление кода:** поле `admin_id` убрано из вставки; `db/deploy.sql` делает колонку nullable.

---

## ⚠️ Осталось — только запустить SQL

### Шаг 1. Запустить `db/deploy.sql` в Supabase SQL Editor

Это единый идемпотентный файл. Заменяет все предыдущие migration-файлы.  
В конце выводит таблицу проверки — все 27 таблиц должны показать `OK`.

```
db/deploy.sql  ← единственный файл для запуска
```

> Старые файлы (`fix_migrations.sql`, `platform_and_geohunt.sql`, `promo_campaigns.sql`) — больше не нужны, `deploy.sql` их заменяет.

---

### Шаг 2. Пополнить `platform_wallet`

`apply_checkin_bonus` выдаёт GEO из `platform_wallet`. При нулевом балансе promo/geohunt/gamification multipliers не выдают ничего молча.

```sql
UPDATE platform_wallet SET balance = balance + 1000000 WHERE id = 1;
```

---

### Шаг 3. Установить env vars

**Railway (API):**
```
BOT_TOKEN              <- ОБЯЗАТЕЛЬНО (сервер не стартует)
SUPER_ADMIN_TG_ID      <- ОБЯЗАТЕЛЬНО (сервер не стартует)
SUPABASE_URL           <- ОБЯЗАТЕЛЬНО
SUPABASE_SERVICE_KEY   <- ОБЯЗАТЕЛЬНО
WEBHOOK_SECRET         <- РЕКОМЕНДУЕТСЯ
GEO_RATE               <- РЕКОМЕНДУЕТСЯ (иначе fallback = 1000 UZS/GEO)
WEBAPP_URL             <- НУЖЕН для QR-кодов geohunt
RAILWAY_PUBLIC_DOMAIN  <- НУЖЕН для авторегистрации webhook
```

**Vite (miniapp/.env.production):**
```
VITE_API_URL             <- URL Railway деплоя
VITE_SUPER_ADMIN_TG_ID   <- Telegram ID супер-админа
```

---

## 🟡 WARNING — Требуют внимания

### W4. `webhookSecret` небезопасный fallback на строку `'webhook'`

**Файл:** `api/index.js` строка 153  
**Проблема:** Если `WEBHOOK_SECRET` и `BOT_TOKEN` не установлены, webhook-путь становится `/bot/webhook` — предсказуемый.

**Фикс:** Обязательно установить `WEBHOOK_SECRET` в Railway env.

---

### W5. `platform_wallet` должен быть пополнен до запуска

**Проблема:** `apply_checkin_bonus` выдаёт GEO из `platform_wallet`. Если баланс = 0 — promo/geohunt/gamification multipliers молча не выдают ничего.

**Фикс:**
```sql
UPDATE platform_wallet SET balance = balance + 1000000 WHERE id = 1;
```

---

## SOLID — Без изменений

### Безопасность

| Проверка | Статус |
|----------|--------|
| HMAC-SHA256 валидация Telegram initData | OK — правильная реализация |
| Replay attack prevention (auth_date 24h TTL) | OK |
| Бот-аккаунты заблокированы (is_bot) | OK |
| Бан блокирует ВСЕ API (в validateTma глобально) | OK |
| Все write-endpoints за validateTma | OK |
| SA-routes за requireSuperAdmin | OK |
| Hardcoded admin ID убран, только env | OK |
| Rate limiting на всех ключевых endpoint-ах | OK |
| Input validation (координаты, суммы, карты) | OK |
| HTTPS-only проверка для sendQr | OK |
| Security headers (nosniff, X-Frame-Options, Referrer-Policy) | OK |
| SQL injection — только Supabase ORM, нет интерполяции | OK |

### Бизнес-логика

| Проверка | Статус |
|----------|--------|
| Атомарный чекин (race-condition safe, FOR UPDATE locks) | OK |
| Атомарный вывод (process_withdrawal) | OK |
| Двойной клейм promo (INSERT first + 23505 duplicate) | OK |
| Реферальный passive income после каждого чекина | OK |
| headerCache.reset() после вывода и чекина | OK |
| Геймификация (стрики, XP, достижения, fire-and-forget) | OK |
| Комиссия 5% при создании кампании | OK |
| Автостоп кампании при нехватке баланса | OK |
| Антифрод кулдаун per-business 24h | OK |
| GeoCode burn atomicity (.is('used_by', null)) | OK |

### Инфраструктура

| Проверка | Статус |
|----------|--------|
| /health endpoint (до rate-limiting) | OK |
| Crash при старте если BOT_TOKEN не задан | OK — process.exit(1) |
| Crash при старте если SUPER_ADMIN_TG_ID не задан | OK — process.exit(1) |
| trust proxy 1 для Railway | OK |
| JSON body limit 64kb | OK |
| 404 / 500 global error handlers | OK |
| Webhook авторегистрация при старте | OK |

---

## Env vars чеклист

**Railway (API):**
```
BOT_TOKEN              <- ОБЯЗАТЕЛЬНО (сервер не стартует)
SUPER_ADMIN_TG_ID      <- ОБЯЗАТЕЛЬНО (сервер не стартует)
SUPABASE_URL           <- ОБЯЗАТЕЛЬНО
SUPABASE_SERVICE_KEY   <- ОБЯЗАТЕЛЬНО
WEBHOOK_SECRET         <- РЕКОМЕНДУЕТСЯ (иначе fallback = часть BOT_TOKEN)
GEO_RATE               <- РЕКОМЕНДУЕТСЯ (иначе fallback = 1000 UZS/GEO)
WEBAPP_URL             <- НУЖЕН для QR-кодов geohunt (без него ссылки сломаны)
RAILWAY_PUBLIC_DOMAIN  <- НУЖЕН для авторегистрации webhook
OPERATOR_SECRET        <- Только если используешь operator topup endpoint
PORT                   <- Railway подставляет автоматически
```

**Vite (miniapp/.env.production):**
```
VITE_API_URL             <- URL Railway деплоя
VITE_SUPER_ADMIN_TG_ID   <- Telegram ID супер-админа
```

---

## Карта файлов БД

```
db/
├── deploy.sql          <- ЗАПУСКАТЬ (единственный, заменяет все остальные)
├── check_tables.sql    <- ДИАГНОСТИКА после deploy.sql
├── schema.sql          <- УСТАРЕВШИЙ (не запускать)
├── fix_migrations.sql  <- УСТАРЕВШИЙ (включён в deploy.sql)
└── migrations/         <- УСТАРЕВШИЕ (включены в deploy.sql)
```

---

## Action Plan

```
[x] C1-C4. Критические DB-проблемы — исправлены в deploy.sql
[x] W1-W2. console.log в prod — заменены на no-op helpers (clog/cwarn/cerr)
[x] W3.    sa_audit_log admin_id null — исправлено в коде и deploy.sql

[ ] 1. Запустить db/deploy.sql в Supabase SQL Editor
[ ] 2. Финальная таблица в конце скрипта: все 27 строк должны показать "OK"
[ ] 3. UPDATE platform_wallet SET balance = balance + 1000000 WHERE id = 1;
[ ] 4. Установить все env vars на Railway
[ ] 5. Убедиться что WEBAPP_URL задан (нужен для QR-кодов geohunt)
[ ] 6. End-to-end тест: бизнес -> кампания -> QR-чекин -> вывод -> SA одобрение
[ ] 7. GET /health -> 200
```

---

*Отчёт подготовлен на основе полного аудита кода. 2026-05-14*
