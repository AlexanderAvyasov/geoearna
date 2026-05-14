# GeoEarn — Аудит антифрод системы
**Дата:** 2026-05-14  
**Аудитор:** Claude Sonnet 4.6 (автоматизированный аудит)  
**Область:** Полный backend + DB, все маршруты, middleware, сервисы, схема БД

---

## 1. Резюме

Система содержит **базовый слой защиты** (HMAC-аутентификация Telegram, 24-часовой кулдаун по заведению, геопроверка радиуса, атомарные DB-транзакции, ручное одобрение выводов). Однако **три специфических сценария мошенничества**, описанных в задании, **системой не детектируются вообще**.

| Сценарий | Статус защиты |
|----------|--------------|
| Группа 3+ человек с совпадающими чекинами | ❌ Не детектируется |
| Реферальная цепочка внутри одной группы | ❌ Не детектируется |
| Одно устройство — несколько аккаунтов | ❌ Не детектируется |

---

## 2. Что сейчас есть в системе

### 2.1 `api/middleware/antifraud.js`
Единственный явный антифрод-чек. Логика: один пользователь не может дважды чекиниться в **одном заведении** за 24 часа.

```
POST /api/checkin
→ antifraud middleware
  → lookup business/campaign by qrToken
  → SELECT visits WHERE user_id=? AND business_id=? AND created_at > NOW()-24h
  → если есть — 429 TOO_SOON
```

**Закрывает:** повторные чекины в одном месте.  
**Не закрывает:** всё что ниже.

### 2.2 `api/services/geo.js` — проверка радиуса
```js
getDistance({ lat, lng }, { lat: business.lat, lng: business.lng }) > business.radius_m
→ throw TOO_FAR
```
Алгоритм Haversine, проверяется в каждом чекине и promo/claim.  
**Не защищает** от GPS-спуфинга (нет валидации источника координат).

### 2.3 `api/middleware/validateTma.js` — аутентификация Telegram
- HMAC-SHA256 по `bot_token`, стандартный протокол Telegram WebApp
- Freshness: `auth_date` не старше 86400 секунд (24 часа)
- Блокировка ботов: проверка `is_bot`
- Проверка бана: `user.banned_at IS NOT NULL → 401`

**Сильная сторона.** Не даёт неаутентифицированным запросам пройти.  
**Слабая сторона:** не мешает одному человеку иметь 2–3 аккаунта Telegram.

### 2.4 Rate Limiting (`api/index.js`)
| Маршрут | Лимит |
|---------|-------|
| `POST /api/checkin` | 10 req/мин/IP |
| `POST /api/promo/claim` | 10 req/мин/IP |
| `POST /api/geohunt/claim` | 10 req/мин/IP |
| `POST /api/withdraw` | 5 req/час/IP |
| `GET /api/checkin/info` | 30 req/мин/IP |
| Все `/api/*` | 120 req/мин/IP |

Лимиты **по IP**, не по user_id. При мобильных сетях несколько пользователей могут делить один IP → ложные срабатывания. При прокси — обход тривиален.

### 2.5 PIN-верификация
Бизнес может включить `requires_pin = true` для кампании. Тогда:
- Генерируется 6-значный одноразовый PIN с TTL 15 минут
- PIN помечается `used = true` сразу после использования

Закрывает сценарий "отсканировал QR издалека, не будучи в заведении". Но PIN не обязателен — каждый бизнес сам решает.

### 2.6 Атомарные DB-функции
`process_checkin`, `process_withdrawal`, `activate_referral` — все используют `FOR UPDATE` lock. Race conditions по балансу исключены.

### 2.7 Реферальная система
```
referrals.referred_id — UNIQUE (один реферал на пользователя)
activate_referral() — только при ПЕРВОМ чекине
passive_until = NOW() + 30 days — пассивный доход 5% от наград рефера
7-day window — активация только в течение 7 дней после создания реферала
```

**Бонусы (из JS-кода `checkin.js`):**
- Реферер: `REFERRAL_BONUS_REFERRER = 25 GEO`
- Новый пользователь: `REFERRAL_BONUS_NEW_USER = 10 GEO`

> ⚠️ **Расхождение:** SQL-функция `activate_referral` в schema.sql даёт +1000 GEO рефереру и +500 GEO новому пользователю — это другие суммы. Нужно проверить, какая функция реально вызывается. JS-код использует `apply_checkin_bonus`, а не `activate_referral()` через rpc. SQL-функция может быть устаревшей. Если она всё же вызывается откуда-то ещё — это критический пересмотр экономики.

### 2.8 Аудит-лог (`sa_audit_log`)
Все действия суперадмина логируются: бан/разбан пользователей, кредиты, изменение курса, одобрение выводов.

---

## 3. Детальный анализ трёх целевых сценариев мошенничества

### Сценарий A: Группа 3+ человек — одни заведения, одно время

**Как работает:** Люди договариваются. Каждый идёт в кофейню, все сканируют QR в течение 10 минут. 24-часовой кулдаун antifraud.js не мешает — каждый уникальный пользователь сканирует каждое заведение раз в сутки. Завтра — снова.

**Почему опасно:** Кампания рассчитана на реальных покупателей. Если 5 фиктивных пользователей совершают по 2 чекина в день в одних и тех же заведениях — кампания исчерпывается без продаж.

**Что хранится в БД для детекции:**
```sql
visits (user_id, business_id, created_at)
referrals (referrer_id, referred_id, activated)
```

**SQL для детекции координированных чекинов (запрос вручную через суперадмин):**
```sql
-- Пары пользователей, которые чекинились в одном заведении в одно и то же время (±15 мин)
SELECT
  v1.user_id     AS user_a,
  v2.user_id     AS user_b,
  COUNT(*)       AS shared_visits,
  array_agg(DISTINCT v1.business_id ORDER BY v1.business_id) AS businesses
FROM visits v1
JOIN visits v2
  ON  v1.business_id = v2.business_id
  AND v1.user_id < v2.user_id
  AND ABS(EXTRACT(EPOCH FROM (v1.created_at - v2.created_at))) < 900  -- 15 минут
GROUP BY v1.user_id, v2.user_id
HAVING COUNT(*) >= 3
ORDER BY shared_visits DESC;
```

```sql
-- Группы 3+ человек с ≥5 общих чекинов (клики)
WITH pairs AS (
  SELECT v1.user_id AS ua, v2.user_id AS ub, v1.business_id, v1.created_at
  FROM visits v1
  JOIN visits v2
    ON  v1.business_id = v2.business_id
    AND v1.user_id < v2.user_id
    AND ABS(EXTRACT(EPOCH FROM (v1.created_at - v2.created_at))) < 900
),
strong_pairs AS (
  SELECT ua, ub FROM pairs GROUP BY ua, ub HAVING COUNT(*) >= 5
)
-- Найти компоненты связности (приблизительно)
SELECT ua AS suspect_user, COUNT(*) AS connected_to
FROM strong_pairs GROUP BY ua
HAVING COUNT(*) >= 2
ORDER BY connected_to DESC;
```

**Вывод:** Данные для детекции есть в БД, но ни один автоматический процесс их не анализирует.

---

### Сценарий B: Реферальная цепочка внутри одной группы

**Как работает:** Пользователь A регистрируется, зовёт B по рефералке. B зовёт C. Все трое ходят вместе. Ни один из них не является реальным покупателем — они просто делятся бонусами внутри группы.

**Что сейчас защищает:**
- `referred_id UNIQUE` — невозможно быть референым дважды
- Активация только на первый чекин

**Что не защищает:**
- Закрытость сети: A→B→C→D могут существовать и получать взаимные бонусы
- Нет детекции "все рефералы ходят только вместе"

**SQL для детекции реферальных колец с совместными чекинами:**
```sql
-- Реферальные пары, которые чекинятся вместе (тот же бизнес, то же время)
WITH ref_pairs AS (
  SELECT referrer_id AS ua, referred_id AS ub FROM referrals WHERE activated = true
),
co_visits AS (
  SELECT v1.user_id AS ua, v2.user_id AS ub, COUNT(*) AS cnt
  FROM visits v1
  JOIN visits v2
    ON  v1.business_id = v2.business_id
    AND v1.user_id != v2.user_id
    AND ABS(EXTRACT(EPOCH FROM (v1.created_at - v2.created_at))) < 900
  GROUP BY v1.user_id, v2.user_id
)
SELECT
  r.ua AS referrer_id,
  r.ub AS referred_id,
  cv.cnt AS joint_checkins,
  u1.username AS referrer_username,
  u2.username AS referred_username
FROM ref_pairs r
JOIN co_visits cv ON (cv.ua = r.ua AND cv.ub = r.ub) OR (cv.ua = r.ub AND cv.ub = r.ua)
JOIN users u1 ON u1.id = r.ua
JOIN users u2 ON u2.id = r.ub
WHERE cv.cnt >= 3
ORDER BY cv.cnt DESC;
```

```sql
-- Реферальные деревья, где все узлы чекинятся в одних и тех же заведениях
WITH RECURSIVE ref_tree AS (
  SELECT referrer_id AS root, referred_id AS member, 1 AS depth
  FROM referrals WHERE activated = true
  UNION ALL
  SELECT rt.root, r.referred_id, rt.depth + 1
  FROM referrals r
  JOIN ref_tree rt ON r.referrer_id = rt.member
  WHERE rt.depth < 4
),
member_businesses AS (
  SELECT rt.root, v.business_id, COUNT(DISTINCT rt.member) AS member_count
  FROM ref_tree rt
  JOIN visits v ON v.user_id = rt.member
  GROUP BY rt.root, v.business_id
),
tree_sizes AS (
  SELECT root, COUNT(DISTINCT member) AS tree_size FROM ref_tree GROUP BY root
)
SELECT
  mb.root,
  ts.tree_size,
  COUNT(*) AS shared_businesses,
  u.username
FROM member_businesses mb
JOIN tree_sizes ts ON ts.root = mb.root
JOIN users u ON u.id = mb.root
WHERE mb.member_count >= ts.tree_size * 0.8  -- 80% дерева ходит в одни заведения
GROUP BY mb.root, ts.tree_size, u.username
HAVING COUNT(*) >= 2
ORDER BY ts.tree_size DESC;
```

---

### Сценарий C: Одно устройство — несколько аккаунтов

**Как работает:** Один человек создаёт 2–3 аккаунта Telegram (или использует чужие). С каждого аккаунта делает чекин в одном и том же заведении. 24-часовой кулдаун не мешает — у каждого аккаунта свой `user_id`.

**Что сейчас:** **Полное отсутствие защиты.** Ни в одном файле нет:
- Сохранения IP-адреса при чекине
- Device fingerprint
- User-agent трекинга
- Сопоставления IP с несколькими `user_id`

Таблица `visits` содержит `lat, lng` но не IP-адрес отправителя запроса.

**Что нужно добавить:** IP-адрес в таблицу `visits` (см. раздел 5).

---

## 4. Полная карта уязвимостей

### Критические (немедленное действие)

| # | Уязвимость | Вектор атаки | Файл |
|---|-----------|-------------|------|
| C1 | Нет IP-трекинга при чекинах | Несколько аккаунтов с одного устройства/IP | `services/checkin.js`, schema.sql |
| C2 | Нет детекции координированных чекинов | Группа ходит вместе без покупок | Нет соответствующего сервиса |
| C3 | Нет детекции реферальных колец | Закрытая группа взаимных рефералов | Нет соответствующего сервиса |
| C4 | GPS-спуфинг не выявляется | Fake GPS приложение — чекин из дома | `services/geo.js` |
| C5 | ~~Расхождение бонусов реферала в JS vs SQL~~ | ✅ Исправлено: SQL-функция обновлена до 25/10 GEO | `schema.sql` |

### Высокие

| # | Уязвимость | Вектор | Файл |
|---|-----------|--------|------|
| H1 | Rate limit только по IP, не по user_id | Один пользователь с прокси обходит лимиты | `api/index.js` |
| H2 | PIN-верификация не обязательна | Бизнесы без PIN уязвимы к удалённому сканированию QR | `middleware/antifraud.js` |
| H3 | Нет velocity check (телепортация) | 2 чекина в разных городах за 5 минут | Нет |
| H4 | Нет сигнала точности GPS от клиента | Точность 5000м принимается наравне с точностью 5м | `services/geo.js` |
| H5 | Нет лимита на количество выводов в день | Spam pending-заявок, нагрузка на суперадмина | `routes/withdraw.js` |

### Средние

| # | Уязвимость | Вектор | Файл |
|---|-----------|--------|------|
| M1 | Нет Luhn-проверки номера карты | Невалидные номера карт в заявках на вывод | `routes/withdraw.js` |
| M2 | Streak freeze не логируется | Злоупотребление фризами без трейла | `services/gamification.js` |
| M3 | platform_wallet истощение — тихое | Пользователи не получают бонусы, никто не уведомлён | schema.sql `apply_checkin_bonus` |
| M4 | PIN брутфорс не блокируется | 1M вариантов, нет счётчика неудачных попыток | `services/checkin.js` |
| M5 | Таймзона жёстко зашита (Ташкент) | Эксплойт daily tasks в переходный период | `services/gamification.js:4-5` |
| M6 | SA_ID жёстко прописан в fallback | `'930826522'` в коде — утечка идентификатора | `routes/superadmin.js` |

---

## 5. Конкретный план исправлений

### Приоритет 1: IP-трекинг (устройство ≈ аккаунт)

**Шаг 1 — добавить колонку в `visits`:**
```sql
ALTER TABLE visits ADD COLUMN IF NOT EXISTS client_ip INET;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Индекс для быстрого поиска нескольких аккаунтов с одного IP
CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits (client_ip, created_at DESC);
```

**Шаг 2 — сохранять IP в `checkin.js`:**
```js
// В routes/checkin.js — передать IP в performCheckin
const clientIp = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim();
const userAgent = req.headers['user-agent'] || '';
// Добавить в process_checkin RPC или отдельным UPDATE после

// В services/checkin.js — INSERT visits уже происходит через process_checkin RPC
// Нужно либо добавить параметры p_ip, p_ua в RPC, либо UPDATE visits SET client_ip=...
// после успешного RPC-вызова (менее атомарно, но проще)
```

**Шаг 3 — детект-запрос (запускать ежедневно через cron или вручную):**
```sql
-- Несколько user_id с одного IP за последние 7 дней
SELECT
  client_ip,
  COUNT(DISTINCT user_id) AS accounts,
  array_agg(DISTINCT user_id ORDER BY user_id) AS user_ids,
  COUNT(*) AS total_visits
FROM visits
WHERE created_at > NOW() - INTERVAL '7 days'
  AND client_ip IS NOT NULL
GROUP BY client_ip
HAVING COUNT(DISTINCT user_id) >= 2
ORDER BY accounts DESC, total_visits DESC;
```

---

### Приоритет 2: Детектор координированных чекинов

**Новый файл `api/services/fraudDetector.js`:**
```js
const { supabase } = require('../../db/index');

// Находит подозрительные пары/группы с совместными чекинами
// Запускать: ежедневно через cron или при запросе суперадмина
async function detectCoordinatedGroups({ windowSeconds = 900, minSharedVisits = 3 } = {}) {
  const { data, error } = await supabase.rpc('detect_coordinated_checkins', {
    p_window_sec:   windowSeconds,
    p_min_shared:   minSharedVisits,
    p_days_back:    30,
  });
  if (error) throw error;
  return data;
}

// Находит реферальные пары, совместно чекинящиеся
async function detectReferralRings({ minJointCheckins = 3 } = {}) {
  const { data, error } = await supabase.rpc('detect_referral_rings', {
    p_min_joint: minJointCheckins,
  });
  if (error) throw error;
  return data;
}

module.exports = { detectCoordinatedGroups, detectReferralRings };
```

**SQL-функции в БД:**
```sql
CREATE OR REPLACE FUNCTION detect_coordinated_checkins(
  p_window_sec INTEGER DEFAULT 900,
  p_min_shared INTEGER DEFAULT 3,
  p_days_back  INTEGER DEFAULT 30
) RETURNS TABLE(user_a INTEGER, user_b INTEGER, shared_visits BIGINT, businesses INTEGER[]) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v1.user_id::INTEGER,
    v2.user_id::INTEGER,
    COUNT(*)::BIGINT,
    array_agg(DISTINCT v1.business_id::INTEGER ORDER BY v1.business_id)
  FROM visits v1
  JOIN visits v2
    ON  v1.business_id = v2.business_id
    AND v1.user_id < v2.user_id
    AND ABS(EXTRACT(EPOCH FROM (v1.created_at - v2.created_at))) < p_window_sec
  WHERE v1.created_at > NOW() - (p_days_back || ' days')::INTERVAL
  GROUP BY v1.user_id, v2.user_id
  HAVING COUNT(*) >= p_min_shared
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION detect_referral_rings(
  p_min_joint INTEGER DEFAULT 3
) RETURNS TABLE(referrer_id INTEGER, referred_id INTEGER, joint_checkins BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT r.referrer_id::INTEGER, r.referred_id::INTEGER, COUNT(*)::BIGINT
  FROM referrals r
  JOIN visits v1 ON v1.user_id = r.referrer_id
  JOIN visits v2
    ON  v2.user_id = r.referred_id
    AND v1.business_id = v2.business_id
    AND ABS(EXTRACT(EPOCH FROM (v1.created_at - v2.created_at))) < 900
  WHERE r.activated = true
  GROUP BY r.referrer_id, r.referred_id
  HAVING COUNT(*) >= p_min_joint
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql;
```

---

### Приоритет 3: Таблица подозрительных пользователей

```sql
CREATE TABLE IF NOT EXISTS fraud_flags (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flag_type   VARCHAR(40) NOT NULL,  -- 'coordinated_group', 'shared_ip', 'referral_ring', 'gps_spoof'
  confidence  SMALLINT NOT NULL DEFAULT 50,  -- 0-100
  details     JSONB NOT NULL DEFAULT '{}',
  reviewed    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_user    ON fraud_flags (user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_type    ON fraud_flags (flag_type, reviewed);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_created ON fraud_flags (created_at DESC);
```

---

### Приоритет 4: Velocity check (телепортация)

В `services/checkin.js`, перед `getDistance()`:

```js
// Проверка скорости движения между чекинами
const { data: lastVisit } = await supabase
  .from('visits')
  .select('lat, lng, created_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (lastVisit) {
  const distKm = getDistance({ lat, lng }, { lat: lastVisit.lat, lng: lastVisit.lng }) / 1000;
  const elapsedHours = (Date.now() - new Date(lastVisit.created_at).getTime()) / 3_600_000;
  const speedKmh = distKm / Math.max(elapsedHours, 1/60); // минимум 1 минута
  if (speedKmh > 300) {
    // Логировать, не блокировать сразу — может быть ошибка GPS
    console.warn('[FRAUD:TELEPORT] userId:', userId, 'speed:', speedKmh.toFixed(0), 'km/h');
    // Записать в fraud_flags если таблица существует
  }
}
```

---

### Приоритет 5: Rate limit по user_id

В `api/index.js` — добавить кастомный rate limiter на уровне пользователя:

```js
const userCheckinCounts = new Map(); // userId → { count, resetAt }

function perUserRateLimit(maxPerHour) {
  return (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();
    const now = Date.now();
    const entry = userCheckinCounts.get(userId);
    if (!entry || entry.resetAt < now) {
      userCheckinCounts.set(userId, { count: 1, resetAt: now + 3_600_000 });
      return next();
    }
    if (entry.count >= maxPerHour) {
      return res.status(429).json({ error: 'TOO_MANY_CHECKINS' });
    }
    entry.count++;
    return next();
  };
}

// Применить после validateTma:
// router.post('/api/checkin', validateTma, antifraud, perUserRateLimit(20), ...)
```

---

### Приоритет 6: Endpoint для суперадмина — просмотр фрод-отчёта

В `api/routes/superadmin.js`:

```js
router.get('/api/superadmin/fraud-report', validateSA, async (req, res) => {
  const [groups, rings, sharedIp] = await Promise.all([
    supabase.rpc('detect_coordinated_checkins', { p_window_sec: 900, p_min_shared: 3, p_days_back: 14 }),
    supabase.rpc('detect_referral_rings', { p_min_joint: 3 }),
    supabase.from('visits')
      .select('client_ip, user_id')
      // группировка на уровне SQL через raw query
  ]);
  res.json({
    coordinated_groups: groups.data || [],
    referral_rings:     rings.data || [],
  });
});
```

---

## 6. Сводная таблица приоритетов

| Приоритет | Действие | Трудозатраты | Файлы |
|-----------|---------|-------------|-------|
| 🔴 P1 | IP-трекинг в visits + детект-запрос | 2–3 часа | schema.sql, routes/checkin.js, services/checkin.js |
| 🔴 P2 | SQL-функции detect_coordinated_checkins + detect_referral_rings | 1–2 часа | schema.sql |
| 🔴 P3 | Таблица fraud_flags + запись подозрений | 1 час | schema.sql, services/fraudDetector.js |
| 🟠 P4 | Velocity check (телепортация) в checkin.js | 1 час | services/checkin.js |
| 🟠 P5 | Rate limit по user_id (не только по IP) | 2 часа | api/index.js, middleware/ |
| 🟠 P6 | Endpoint /api/superadmin/fraud-report | 1 час | routes/superadmin.js |
| 🟡 P7 | PIN обязателен для кампаний > X GEO | 30 мин | routes/admin.js, services/checkin.js |
| 🟡 P8 | Luhn-валидация карты при выводе | 15 мин | routes/withdraw.js |
| 🟡 P9 | Лимит выводов: 3 заявки в день на user | 30 мин | routes/withdraw.js |
| 🟡 P10 | Исправить расхождение бонусов реферала (JS vs SQL) | 30 мин | services/checkin.js / schema.sql |
| 🟢 P11 | Alert при истощении platform_wallet | 1 час | services/notify.js, schema.sql |
| 🟢 P12 | Убрать fallback SA_ID из кода в env | 15 мин | routes/superadmin.js |

---

## 7. Немедленные ручные проверки (без изменения кода)

Запустить прямо сейчас в Supabase SQL Editor для оценки масштаба проблемы:

```sql
-- 1. Топ подозрительных пар пользователей (совместные чекины ±15 мин)
SELECT v1.user_id, v2.user_id, COUNT(*) AS joint
FROM visits v1
JOIN visits v2 ON v1.business_id = v2.business_id
  AND v1.user_id < v2.user_id
  AND ABS(EXTRACT(EPOCH FROM (v1.created_at - v2.created_at))) < 900
WHERE v1.created_at > NOW() - INTERVAL '30 days'
GROUP BY 1, 2 HAVING COUNT(*) >= 3
ORDER BY joint DESC LIMIT 20;

-- 2. Реферальные пары с совместными чекинами
SELECT r.referrer_id, r.referred_id, COUNT(*) AS joint
FROM referrals r
JOIN visits v1 ON v1.user_id = r.referrer_id
JOIN visits v2 ON v2.user_id = r.referred_id
  AND v1.business_id = v2.business_id
  AND ABS(EXTRACT(EPOCH FROM (v1.created_at - v2.created_at))) < 900
WHERE r.activated = true
GROUP BY 1, 2 HAVING COUNT(*) >= 3
ORDER BY joint DESC LIMIT 20;

-- 3. Пользователи с аномально высоким количеством уникальных заведений за неделю
SELECT user_id, COUNT(DISTINCT business_id) AS unique_places, COUNT(*) AS total_visits
FROM visits
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
HAVING COUNT(DISTINCT business_id) > 10
ORDER BY unique_places DESC LIMIT 20;

-- 4. Самые быстрые чекины (возможная телепортация)
SELECT v1.user_id,
  v1.business_id AS from_biz, v2.business_id AS to_biz,
  ROUND(EXTRACT(EPOCH FROM (v2.created_at - v1.created_at)) / 60, 1) AS elapsed_min,
  v1.created_at
FROM visits v1
JOIN visits v2 ON v2.user_id = v1.user_id
  AND v2.created_at > v1.created_at
  AND v2.business_id != v1.business_id
  AND v2.created_at < v1.created_at + INTERVAL '10 minutes'
WHERE v1.created_at > NOW() - INTERVAL '7 days'
ORDER BY elapsed_min ASC LIMIT 20;
```

---

## 8. Итог

**Главный вывод:** Система хорошо защищает финансовую целостность (нет двойного списания, ручное одобрение выводов, HMAC-auth) — но поведенческая аналитика и детекция координированного мошенничества полностью отсутствуют.

Описанная мошенническая схема (группа без покупок + реферальная сеть внутри группы + возможное использование одного устройства) **невидима для текущей системы** и может систематически дренировать бюджеты кампаний.

Минимальный набор для закрытия этих трёх векторов:
1. **IP в таблицу `visits`** — выявляет одно устройство, много аккаунтов
2. **`detect_coordinated_checkins()` SQL-функция** — выявляет группы
3. **`detect_referral_rings()` SQL-функция** — выявляет закрытые реферальные сети
4. **Страница отчёта в суперадмин-панели** — позволяет регулярно мониторить

Все четыре можно реализовать за 1 рабочий день.
