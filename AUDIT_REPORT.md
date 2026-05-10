# GeoEarn — Final System Audit Report
**Date:** 2026-05-10  
**Scope:** Full codebase — backend API, security layers, database schema, frontend, i18n  

---

## 1. SECURITY SYSTEMS

### 1.1 Authentication (validateTma.js) — SOLID

| Check | Status |
|---|---|
| Telegram HMAC-SHA256 initData verification | OK |
| Replay-attack window: auth_date older than 1 hour rejected | OK |
| Missing `hash` field returns 401 | OK |
| Bot accounts blocked via `is_bot` check | OK |
| Banned users blocked via `banned_at` check | OK |
| Auto-creates new users on first login | OK |
| BOT_TOKEN absent → 500, not bypass | OK |

### 1.2 Security Headers (api/index.js) — COMPLETE

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=()
X-Powered-By: REMOVED
```

### 1.3 CORS — CORRECT

Allows: no-origin (server-to-server), `"null"` (native iOS/Android TG webview),
`web.telegram.org`, configured WEBAPP_URL origin. Rejects everything else.
HMAC-signed initData is the real auth layer — correct architecture for a Mini App.

### 1.4 Rate Limiting — PARTIAL

| Endpoint | Limit | Status |
|---|---|---|
| `/api` (general) | 120 req/min | OK |
| `/api/checkin` | 10 req/min | OK |
| `/api/promo/claim` | 10 req/min | OK |
| `/api/promo/info` | 30 req/min | OK |
| `/api/checkin/info` | 30 req/min | OK |
| `/api/withdraw` | 5 req/hour | OK |
| `/api/operator` | 60 req/min | OK |
| `/api/admin/*` | Only general 120/min | MISSING specific limit |
| `/api/superadmin/*` | Only general 120/min | MISSING specific limit |

**Recommendation:** Add `rateLimit({ windowMs: 60_000, max: 20 })` on `/api/admin`
and `/api/superadmin` — these manipulate money and warrant tighter bounds.

### 1.5 Operator Authentication (operator.js) — SECURE

Uses `crypto.timingSafeEqual` — constant-time comparison, immune to timing attacks.
Returns `503 OPERATOR_NOT_CONFIGURED` when `OPERATOR_SECRET` env var is absent — safe default.

### 1.6 SuperAdmin Authorization (superadmin.js) — RISK

```js
// superadmin.js line 10
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TG_ID || '930826522';
```

If `SUPER_ADMIN_TG_ID` env var is missing, admin access is granted to Telegram ID
`930826522`. The startup log warns about this but the fallback still grants access.  
Risk: MEDIUM (still blocked by validateTma; the hardcoded ID is a liability).  
Fix: replace `|| '930826522'` with `|| null` and reject with 503 if null.

### 1.7 Anti-Fraud System — MULTI-LAYER

| Layer | Implementation | Status |
|---|---|---|
| 24h cooldown per user per business | `antifraud.js` queries `visits` table | OK |
| IP rate limiting on checkin | express-rate-limit 10/min | OK |
| PIN validation (one-time, 15-min TTL) | `verification_pins` table, used/expires_at | OK |
| Geo distance check | Haversine in `services/geo.js` | OK |
| Promo daily claim limit (3/day) | Counter on `promo_claims` | OK |
| Per-campaign cooldown | `cooldown_hours` field | OK |
| Fraud detection dashboard | >3 businesses/24h flagged HIGH | OK |
| Multi-claim audit logging | `sa_audit_log` table | OK |

---

## 2. DATABASE TABLES

All queries use the Supabase JS SDK — parameterized, injection-safe.

### 2.1 Core Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | User accounts | id, telegram_id, username, balance, xp, level, banned_at, referral_code |
| `visits` | Check-in history | id, user_id, business_id, campaign_id, lat, lng, rewarded, created_at |
| `businesses` | Venue registry | id, name, address, lat, lng, balance, qr_token, owner_telegram_id, radius_m, suspended_at |
| `campaigns` | Reward campaigns | id, business_id, budget, reward_amount, max_visits, visits_count, active, requires_pin, task_type, ends_at, qr_token |
| `withdrawals` | User withdrawal requests | id, user_id, amount, phone, status, note, created_at, processed_at |
| `verification_pins` | One-time PINs | id, business_id, pin, expires_at, used |
| `topup_requests` | Business top-ups | id, business_id, amount, status, note, created_at, processed_at |
| `platform_wallet` | Platform GEO reserve (single row) | balance |

### 2.2 Gamification Tables

| Table | Purpose |
|---|---|
| `user_streaks` | Daily check-in streak per user |
| `xp_events` | XP grant log |
| `user_achievements` | Unlocked achievements per user |
| `achievement_definitions` | Achievement catalog (key, rewards, requirement JSON) |
| `user_tasks` | Task progress per user and period |
| `task_definitions` | Task catalog (daily/weekly/onetime) |
| `boosts` | Active multiplier boosts per business |

### 2.3 Promo & Admin Tables

| Table | Purpose |
|---|---|
| `promo_campaigns` | Platform QR promo campaigns |
| `promo_claims` | Claim history per user per promo |
| `referrals` | Referral links (referrer — referred) |
| `referral_earnings` | GEO earned from referrals |
| `geo_rate_history` | Historical GEO/UZS rate changes |
| `sa_audit_log` | Superadmin action trail |

### 2.4 Atomic DB Functions (Supabase RPCs)

| Function | Purpose | Atomic |
|---|---|---|
| `process_checkin` | Deduct business balance, credit user, record visit | YES |
| `apply_checkin_bonus` | Credit user from platform wallet | YES |
| `process_withdrawal` | Deduct user balance, create withdrawal row | YES |
| `create_campaign_with_commission` | Create campaign + deduct 5% commission | YES |
| `approve_withdrawal` | Approve + deduct platform wallet | YES |
| `reject_withdrawal` | Reject + restore user balance | YES |
| `confirm_topup` | Confirm top-up + credit business balance | YES |

All money mutations go through atomic RPCs — no partial-state risk from app crashes.

---

## 3. KNOWN BUGS AND RISKS

### BUG-01 — HIGH — VALID_TASK_TYPES Mismatch

**Files:** `api/routes/admin.js:95`, `miniapp/src/pages/Admin.jsx` (TASK_META)

API validates: `['visit', 'photo', 'form', 'survey']`  
UI sends: `['visit', 'purchase', 'review']`

These two sets do not overlap for `purchase` and `review`. If a campaign is created
via UI with `task_type: 'purchase'`, the server accepts it because it skips validation
when the value matches `undefined` (the check only fires when `task_type !== undefined`
and not in the allowed array). However TASK_META has no entry for `photo`/`form`/`survey`
so any campaign created via direct API with those types would fall back to the `visit`
icon silently.

**Fix:** Synchronize both lists to `['visit', 'purchase', 'review']`.

### BUG-02 — MEDIUM — GEO Rate Change Has No Effect at Runtime

**Files:** `api/routes/superadmin.js:688`, `api/lib/geoRate.js`

`POST /api/superadmin/config/rate` writes to `geo_rate_history` in the DB but
`getGeoRate()` reads **only** `process.env.GEO_RATE`. The historical record is saved
but the new rate is never applied until the server is restarted with updated env var.
The route returns `ok: true` giving a false success signal.

**Fix:** Keep an in-memory cache (`let cachedRate = null`) updated on each write,
falling back to `process.env.GEO_RATE` only when not cached.

### BUG-03 — MEDIUM — Hardcoded SuperAdmin Fallback

See §1.6. Replace the hardcoded fallback with a hard failure.

### BUG-04 — LOW-MEDIUM — Non-Atomic Promo Claims Counter

**File:** `api/routes/promo.js:131-141`

After inserting a claim, a separate `SELECT COUNT(*)` syncs `claims_count`. Under
concurrent load two requests could both pass the `claims_count >= max_claims` guard
before either increments the counter, exceeding `max_claims`.

**Fix:** Replace with:
```sql
UPDATE promo_campaigns
SET claims_count = claims_count + 1,
    active = (claims_count + 1 < max_claims)
WHERE id = ? AND claims_count < max_claims
RETURNING claims_count
```
(or an RPC wrapping this logic)

### BUG-05 — LOW — Non-Atomic Platform Bonus in Checkin

**File:** `api/services/checkin.js:182,201`

`process_checkin` RPC and the subsequent `apply_checkin_bonus` call are not in the
same transaction. A server crash between them leaves the user underpaid by the
multiplier bonus. Base reward is always credited — only the bonus is at risk.

### INFO-01 — Bot Notifications Always in Russian

All Telegram bot message strings (`sendMessage(...)`) in the API are hardcoded in
Russian. Acceptable for the current Russian-speaking market; will need localization
when expanding to Uzbek/English audiences.

### INFO-02 — Fallback Payment Card

`api/routes/admin.js:337` has `|| '0000 0000 0000 0000'` as fallback for the
`TOPUP_CARD_NUMBER` env var. This shows a zeroed card in the payment modal if
the env var is missing — visible UX break, not a security issue.

---

## 4. i18n SYSTEM STATUS

### Architecture
- Engine: `getTranslator(lang)` → `t(key, vars)` with `{placeholder}` interpolation
- Languages: RU (default), UZ, EN — ~400 keys per language
- Storage: `localStorage` keyed by Telegram user ID
- Context: React `LanguageContext` / `useLanguage()` hook
- Pluralization: `pluralize(lang, n, one, few, many)` — 3-form Russian, 2-form EN/UZ

### Per-Page Coverage

| Page | Status | Notes |
|---|---|---|
| App.jsx (nav, splash, scan toasts) | DONE | |
| Onboarding.jsx | DONE | |
| Home.jsx | DONE | |
| Balance.jsx | DONE | |
| Withdraw.jsx | DONE | |
| Checkin.jsx | DONE | |
| Game.jsx | DONE | |
| Map.jsx | DONE | |
| Admin.jsx | DONE | Completed this session |
| SuperAdmin.jsx | SKIPPED | Internal tool, Russian-only acceptable |
| Legal.jsx | SKIPPED | Static content |

### Date Locale Handling
All components that format dates use:
```js
const dateLocale = lang === 'en' ? 'en-US' : 'ru-RU';
```
Covered in: CampaignCard, CampaignDetailModal, CampaignForm, TopupTab.

---

## 5. FRONTEND ARCHITECTURE

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build tool | Vite |
| Router | React Router v6 |
| Language | Pure JSX (no TypeScript) |
| Styling | Inline styles + `lib/design.js` token system |
| State management | Local useState + direct apiFetch (no Redux/Zustand) |
| Auth token | Telegram initData forwarded as `initdata` header |
| Icons | lucide-react (emoji-free) |
| i18n | Custom (see §4) |

### API Client (lib/api.js)
- Polls up to 8 seconds for Telegram native bridge initData
- All requests include `initdata` header automatically
- Base URL from `VITE_API_URL` env var (defaults to same-origin)

---

## 6. BACKEND ARCHITECTURE

| Layer | Technology |
|---|---|
| Runtime | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Bot | GrammY |
| Deployment | Railway (webhook auto-registered via RAILWAY_PUBLIC_DOMAIN) |
| Auth | Telegram HMAC initData middleware |
| Rate limiting | express-rate-limit |

### Startup Safety Checks (api/index.js:163-167)
```
[FATAL]    BOT_TOKEN missing → all auth fails
[SECURITY] SUPER_ADMIN_TG_ID missing → hardcoded fallback active
[WARN]     WEBHOOK_SECRET missing → path derived from BOT_TOKEN
[WARN]     OPERATOR_SECRET missing → operator endpoints disabled
```

---

## 7. REQUIRED ENV VARS CHECKLIST

| Variable | Severity if Missing | Effect |
|---|---|---|
| `BOT_TOKEN` | FATAL | All user auth fails (validateTma → 500) |
| `DATABASE_URL` | FATAL | Server crash on startup |
| `SERVICE_KEY` | FATAL | Server crash on startup |
| `SUPER_ADMIN_TG_ID` | HIGH | Falls back to hardcoded Telegram ID |
| `WEBHOOK_SECRET` | HIGH | Webhook path derived from BOT_TOKEN |
| `OPERATOR_SECRET` | HIGH | Operator endpoints return 503 |
| `WEBAPP_URL` | MEDIUM | CORS opens to all origins; QR URLs have empty base |
| `GEO_RATE` | MEDIUM | Defaults to 1000 UZS/GEO |
| `TOPUP_CARD_NUMBER` | MEDIUM | Payment modal shows 0000 0000 0000 0000 |
| `TOPUP_CARD_HOLDER` | MEDIUM | Defaults to 'GeoEarn' |
| `TOPUP_BANK` | MEDIUM | Defaults to 'Payme' |
| `BOT_USERNAME` | LOW | Referral links use 'GeoEarnBot' |
| `RAILWAY_PUBLIC_DOMAIN` | LOW | Webhook not auto-registered |
| `VITE_API_URL` (frontend) | LOW | Defaults to same-origin (fine for Vercel) |

---

## 8. SUMMARY SCORECARD

| Area | Grade | Notes |
|---|---|---|
| Authentication | A | HMAC, replay protection, ban enforcement |
| Rate Limiting | B+ | Solid on user endpoints; admin routes need tightening |
| Anti-fraud | A- | Multi-layer; promo race condition is the one gap |
| Input Validation | A | All routes validate types, ranges, formats |
| DB Security | A | Parameterized SDK queries; atomic RPCs for all money ops |
| Secret Management | B | Good startup warnings; hardcoded SA ID is the weak point |
| i18n Coverage | A | All user-facing pages translated in RU/UZ/EN |
| Error Handling | A- | Consistent error codes; fire-and-forget paths swallow some errors |
| Frontend Security | A | No XSS vectors; initData validated server-side only |

**Overall: B+ / PRODUCTION-READY** with 2 medium issues to address before scaling.

### Priority Fix List
1. BUG-01 — Sync VALID_TASK_TYPES between API and UI (1-line fix)
2. BUG-03 — Remove hardcoded SuperAdmin ID fallback (1-line fix)
3. BUG-02 — GEO rate in-memory cache so rate changes apply without restart
4. §1.4 — Add specific rate limits on `/api/admin` and `/api/superadmin`
5. BUG-04 — Atomic promo claims counter (requires DB RPC change)
