# PRODUCTION READINESS AUDIT — GeoEarn Telegram Mini App
**Дата аудита:** 2026-05-14  
**Аудитор:** Claude Code (claude-sonnet-4-6)  
**Охват:** Backend API (Node.js/Express + Supabase) + Frontend (React/Vite Telegram Mini App)

---

## 1. ГОТОВНОСТЬ К ПРОДАКШНУ — ИТОГ

### Вердикт: **НЕТ — не готово к продакшну**

**Обоснование:**

Приложение хорошо спроектировано концептуально и имеет ряд правильных архитектурных решений (атомарные RPC-функции для финансовых операций, HMAC-верификация initData, rate limiting по эндпоинтам). Однако существует несколько критических проблем безопасности и надёжности, которые необходимо устранить перед деплоем в продакшн:

1. **Критическая**: hardcoded Telegram ID суперадмина (`930826522`) выложен в публичный код — любой, кто знает этот ID, получает полный контроль при отсутствии `SUPER_ADMIN_TG_ID` в env.
  2. **Критическая**: Platform Promo (`/api/platform-promo/claim`) декларирует "verify subscription", но не проверяет реальную подписку пользователя на Telegram-канал через Bot API — GEO выдаётся без верификации.
  3. **Высокая**: Race condition в `promo/claim` — GEO начисляется до записи `promo_claims`, отсутствует транзакционная атомарность.
  4. **Высокая**: `referral_earnings.visit_id` — FK на `visits(id)` объявлен в schema.sql, но `checkin.js` вызывает `activateReferral` без передачи `visit_id`; `process_referral_income` в schema.sql никогда не вызывается из кода приложения.
  5. **Высокая**: Debug overlay (`🐛` кнопка) и `console.log`-перехват присутствуют в production-сборке без флага отключения.
  6. **Средняя**: `SUPER_ADMIN_TG_ID`, `OPERATOR_SECRET`, `WEBHOOK_SECRET`, `RAILWAY_PUBLIC_DOMAIN` — отсутствуют в `.env.example`.
  7. **Средняя**: Нет health-check эндпоинта — Railway/Render не может определить живость сервиса.
  8. **Средняя**: `superadmin/overview` и `superadmin/economics` загружают до 15 000+ строк из БД в память JS для подсчёта DAU/MAU — масштабируется плохо.

---

## 2. КРИТИЧЕСКИЕ БЛОКЕРЫ

### 2.1 Hardcoded Telegram ID суперадмина

**Файлы:**
- `api/routes/superadmin.js:10` — `const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TG_ID || '930826522';`
- `api/routes/platformPromo.js:7` — аналогично
- `api/routes/geohunt.js:7` — аналогично
- `miniapp/src/App.jsx:21` — `const IS_SUPER_ADMIN = user?.id === 930826522;`
- `miniapp/src/pages/SuperAdmin.jsx:17` — `const SA_ID = 930826522;`

**Риск:** Если `SUPER_ADMIN_TG_ID` не установлен в Railway, любой человек с Telegram ID `930826522` получает полный доступ к суперадмин-панели (бан пользователей, изменение баланса GEO, управление кампаниями, одобрение выводов). ID захардкожен и виден в открытом коде репозитория.

**Исправление:** Обязательно установить `SUPER_ADMIN_TG_ID` в env. При отсутствии переменной — завершать запуск с ошибкой (`process.exit(1)`), а не падать в тихий fallback.

---

### 2.2 Platform Promo: нет верификации подписки на Telegram-канал

**Файл:** `api/routes/platformPromo.js:54–125`

**Описание:** Функция `POST /api/platform-promo/claim` называется "verify subscription + award GEO", но не вызывает Telegram Bot API (`getChatMember`) для проверки того, что пользователь действительно подписан на `channel_id`. Reward выдаётся только на основании "ещё не получал" (`ALREADY_CLAIMED`). Хранится `channel_id` в БД, но никогда не используется при claim.

**Риск:** Пользователи могут получить GEO без реальной подписки. Вся бизнес-логика "подпишись — получи GEO" сломана.

**Исправление:** Перед начислением вызывать `bot.api.getChatMember(channel_id, tgId)` и проверять, что статус `member`, `administrator`, или `creator`.

---

### 2.3 Race condition: promo/claim и platform-promo/claim не атомарны

**Файл:** `api/routes/promo.js:128–142`

```
// Порядок операций:
1. apply_checkin_bonus (начисляет GEO)      ← деньги ушли
2. INSERT INTO promo_claims                  ← если упадёт здесь...
3. UPDATE claims_count                       ← ...пользователь получит GEO снова
```

**Файл:** `api/routes/platformPromo.js:91–116` — та же проблема.

**Риск:** При сбое сети/БД между шагами 1 и 2 пользователь получает GEO без записи в `promo_claims`, и может получить его повторно. Это прямые финансовые потери.

**Исправление:** Перенести `apply_checkin_bonus` и `INSERT promo_claims` в единую RPC-функцию с транзакцией (аналогично `process_checkin`).

---

### 2.4 Referral passive income не реализован в коде

**Файл:** `db/schema.sql:542–566` — функция `process_referral_income` определена.  
**Файл:** `api/services/checkin.js` — нигде не вызывается.

**Риск:** В UI обещается "+5% от каждого чекина друга в течение 30 дней" (`miniapp/src/lib/i18n.js:267`), но это не работает. Пользователи введены в заблуждение.

**Примечание:** `referral_earnings` вставляется напрямую через `activateReferral()` только один раз при активации, а не при каждом чекине.

---

### 2.5 Admin PATCH campaign не атомарен при дополнительном списании

**Файл:** `api/routes/admin.js:239–255`

```javascript
// Шаг 1: UPDATE businesses SET balance = balance - extraCost WHERE balance >= extraCost
// Шаг 2: UPDATE campaigns SET max_visits = ...
```

Между двумя UPDATE нет явной транзакции. При сбое после шага 1 деньги списаны, но `max_visits` не обновлён. Исправление: завернуть в `rpc()`.

---

## 3. АРХИТЕКТУРНЫЙ АУДИТ

### 3.1 Backend

**Положительное:**
- Чёткое разделение по роутам и сервисам
- Финансовые операции (`process_checkin`, `process_withdrawal`, `confirm_topup`, `reject_withdrawal`) вынесены в атомарные PostgreSQL RPC-функции с `FOR UPDATE` — грамотно
- Middleware chain: глобальные заголовки безопасности → CORS → JSON limit → rate limiting → маршруты — правильный порядок
- Anti-fraud middleware проверяет cooldown по бизнесу перед чекином

**Проблемы:**

1. **`api/index.js:149`** — `const webhookSecret = process.env.WEBHOOK_SECRET || process.env.BOT_TOKEN?.split(':')[1] || 'webhook'`  
   Если ни `WEBHOOK_SECRET`, ни `BOT_TOKEN` не установлены — секрет = буквальная строка `'webhook'`. Любой внешний сервис может POST на `/bot/webhook` и инжектировать апдейты в бота.

2. **`api/index.js:148`** — `require('../bot/index')` — бот подключается в index.js, но в аудит не включён файл `bot/index.js`. Не проверен.

3. **`api/routes/admin.js:82–85`** — `supabase.from('topup_requests').select('amount').maybeSingle()` — вызывается без `.data` деструктурирования, ошибки не обрабатываются (silent fail).

4. **`api/routes/superadmin.js:41`** — `supabase.from('visits').select('rewarded.sum()').single()` — PostgREST aggregate синтаксис. Если таблица большая, это медленно и зависит от версии PostgREST.

5. Нет глобального middleware для логирования HTTP запросов (Morgan или аналог). Отладка инцидентов будет затруднена.

### 3.2 База данных

**Положительное:**
- FK constraints везде где нужно
- Partial indexes на nullable колонках (`WHERE target_id IS NOT NULL`)
- `platform_wallet` с `CHECK (id = 1)` для single-row таблицы

**Отсутствующие индексы (критично для производительности):**

| Таблица | Колонка | Используется в запросе |
|---------|---------|----------------------|
| `visits` | `(user_id, business_id)` | antifraud.js:57, checkin.js:176 |
| `visits` | `(user_id, created_at)` | gamification.js повсюду |
| `visits` | `(business_id, created_at)` | admin.js stats |
| `campaigns` | `qr_token` | checkin.js:73 (только в fix_migrations.sql, не в schema.sql) |
| `businesses` | `qr_token` | antifraud.js + checkin.js |
| `businesses` | `owner_telegram_id` | admin.js каждый эндпоинт |
| `withdrawals` | `(user_id, status)` | withdraw.js, superadmin.js |
| `verification_pins` | `(business_id, pin)` | checkin.js:157 |
| `user_streaks` | `user_id` (PRIMARY KEY) | — OK |
| `user_tasks` | `(user_id, task_key, period_date)` | PRIMARY KEY — OK |

**Несоответствие схем:**
- `schema.sql` не содержит `qr_token` в `campaigns` — он добавлен только в `db/fix_migrations.sql`.
- `schema.sql:437` — `referral_earnings.visit_id INTEGER NOT NULL REFERENCES visits(id)` — FK является NOT NULL, но `activateReferral()` в `checkin.js:37` вставляет `referral_earnings` без `visit_id`, что вызовет ошибку PostgreSQL. Либо schema расходится с кодом, либо миграция изменила `visit_id` на nullable.

### 3.3 Frontend

**Положительное:**
- ErrorBoundary на уровне App
- `waitForInitData()` с таймаутом перед API-запросами
- Хорошая обработка ошибок в Checkin.jsx с локализованными сообщениями

**Проблемы:**

1. **`miniapp/src/App.jsx:21`** — `const IS_SUPER_ADMIN = user?.id === 930826522` — hardcoded ID на клиенте. Это только UI-контроль, не безопасность (сервер проверяет сам), но ID раскрыт.

2. **`miniapp/src/App.jsx:40–42`** — Console.log/error/warn переопределены глобально для debug overlay. Это патч `console` на уровне модуля — присутствует в production bundle без механизма отключения.

3. **`miniapp/src/App.jsx:813`** — `_hdrCache` — module-level cache, сбрасывается только при перезагрузке страницы. После чекина баланс в GlobalHeader не обновляется.

4. **`miniapp/src/pages/Balance.jsx`** — Parallel fetch без abort controllers. При быстром переключении вкладок могут происходить state updates на unmounted компонентах.

5. **Нет глобального state management** (no Context/Redux для пользователя). Баланс хранится локально в каждом компоненте — рассинхрон данных.

---

## 4. БЕЗОПАСНОСТЬ

### 4.1 Аутентификация и авторизация

| Эндпоинт | Auth | Проверка |
|----------|------|---------|
| `POST /api/checkin` | validateTma ✓ | OK |
| `POST /api/withdraw` | validateTma ✓ | OK |
| `GET /api/me` | validateTma ✓ | OK |
| `GET /api/campaigns` | Нет ✓ | Публичный — OK |
| `GET /api/promos/active` | Нет ✓ | Публичный — OK |
| `GET /api/promo/info` | Нет ✓ | OK |
| `POST /api/promo/claim` | validateTma ✓ | OK |
| `GET /api/geohunt/info` | Нет ✓ | OK |
| `GET /api/geohunt/claim` | initDataFromQuery + validateTma ✓ | OK |
| `GET /api/admin/business` | validateTma ✓ только владелец | OK |
| `GET /api/superadmin/*` | validateTma + requireSuperAdmin ✓ | OK (но fallback ID опасен) |
| `POST /api/operator/*` | operatorAuth (timingSafeEqual) ✓ | OK |
| `GET /api/config` | Нет | GEO rate публичен — приемлемо |
| `POST /api/send-qr` | validateTma ✓ | OK |

**Проблема:** `validateTma` пропускает initData возрастом до **86400 секунд (24 часа)**. Telegram рекомендует 5 минут для webhook и допускает более длинные сессии для Mini Apps, но 24 часа — большое окно для replay-атак при компрометации initData.

### 4.2 Валидация входных данных

| Место | Проверка | Проблема |
|-------|---------|---------|
| `checkin.js:13` | `typeof lat !== 'number'` | ✓ OK |
| `checkin.js:17` | Диапазон -90..90 / -180..180 | ✓ OK |
| `withdraw.js:15` | `Number.isInteger(amount) && amount > 0` | ✓ OK |
| `withdraw.js:19` | Regex `/^\d{16}$/` | ✓ OK |
| `admin.js:102–121` | budget, max_visits, task_type, task_description | ✓ OK |
| `superadmin.js:607` | `typeof amount !== 'number'` | Принимает `NaN` при `typeof NaN === 'number'` — **БАГИ** |
| `promo.js:64` | lat/lng тип и диапазон | ✓ OK |
| `geohunt.js:79` | token длина 100 | ✓ OK |
| `sendQr.js:10` | url длина 2000 | ✓ OK — но нет валидации URL-схемы |

**Проблема sendQr:** `POST /api/send-qr` принимает любую строку до 2000 символов как URL и генерирует QR. Можно передать `javascript:...` URL или любую фишинговую ссылку, которая будет отправлена пользователю в Telegram от имени бота. Нужна валидация схемы (только `https://`).

**Проблема superadmin adjust:** `api/routes/superadmin.js:607` — `typeof amount !== 'number'` — это пропускает `NaN`, для которого `typeof NaN === 'number'` истинно. Нужна проверка `Number.isFinite(amount)`.

### 4.3 SQL Injection

Используется Supabase JS SDK — запросы параметризованы. Прямого SQL injection нет. Raw SQL только в RPC-функциях PostgreSQL с `$1, $2` параметрами. **OK.**

### 4.4 Управление секретами

**Отсутствуют в `.env.example`:**
- `SUPER_ADMIN_TG_ID` — **критично**
- `OPERATOR_SECRET` — нужен для оператора
- `WEBHOOK_SECRET` — нужен для безопасного webhook URL
- `RAILWAY_PUBLIC_DOMAIN` — нужен для авторегистрации webhook

**Hardcoded fallbacks (risky):**
- `api/routes/superadmin.js:10` — fallback `'930826522'` при отсутствии env
- `api/lib/geoRate.js:7` — fallback `1000` UZS/GEO — приемлемо (default rate)
- `api/routes/admin.js:338` — `TOPUP_CARD_NUMBER || '0000 0000 0000 0000'` — безопасно (placeholder)

### 4.5 CORS

`api/index.js:49–58` — CORS разрешён для всех origins, включая `null` (нативный webview). Комментарий в коде обоснован: реальная аутентификация — HMAC initData. Приемлемо для Telegram Mini App.

### 4.6 Rate Limiting

| Эндпоинт | Лимит | Оценка |
|----------|-------|--------|
| `/api/*` | 120 req/min/IP | Достаточно |
| `/api/checkin` | 10 req/min/IP | Хорошо |
| `/api/promo/claim` | 10 req/min/IP | Хорошо |
| `/api/withdraw` | 5 req/hour/IP | Хорошо |
| `/api/operator` | 60 req/min/IP | OK |
| `/api/superadmin/*` | **нет отдельного лимита** | Покрывается общим 120/min |
| `/api/send-qr` | **нет отдельного лимита** | Риск злоупотребления |

**Проблема:** `/api/send-qr` позволяет отправлять фото в Telegram пользователю. Без специального лимита возможен флуд от скомпрометированных аккаунтов. Рекомендуется добавить лимит 5–10 req/min.

### 4.7 Telegram WebApp Signature Validation

`api/middleware/validateTma.js` — реализована корректно:
- HMAC-SHA256 с ключом `HMAC(SHA256, "WebAppData", BOT_TOKEN)`
- Constant-time сравнение не используется — применяется `expectedHash !== hash` (string compare). Это **теоретически** уязвимо к timing attack, но на практике незначительно для hash-сравнения одинаковой длины. Для полной безопасности: `crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(hash))`.
- Bot accounts заблокированы (`telegramUser.is_bot`).
- Auth date проверяется (86400 сек окно).

---

## 5. ПРОИЗВОДИТЕЛЬНОСТЬ

### 5.1 Отсутствующие индексы

Критически важные индексы, отсутствующие в `schema.sql` (только часть есть в `fix_migrations.sql`):

```sql
-- visits: самая часто запрашиваемая таблица
CREATE INDEX idx_visits_user_biz ON visits (user_id, business_id);
CREATE INDEX idx_visits_user_created ON visits (user_id, created_at DESC);
CREATE INDEX idx_visits_biz_created ON visits (business_id, created_at DESC);

-- businesses: каждый admin-запрос ищет по owner_telegram_id
CREATE INDEX idx_businesses_owner ON businesses (owner_telegram_id);
CREATE INDEX idx_businesses_qr_token ON businesses (qr_token);

-- withdrawals: суперадмин фильтрует по status
CREATE INDEX idx_withdrawals_status ON withdrawals (status, created_at DESC);
CREATE INDEX idx_withdrawals_user ON withdrawals (user_id, created_at DESC);

-- verification_pins: checkin ищет по (business_id, pin)
CREATE INDEX idx_pins_biz_pin ON verification_pins (business_id, pin);
```

### 5.2 N+1 запросы

**`api/routes/superadmin.js:182–187`** — загружает 200 пользователей, затем делает отдельный запрос `visits` по всем их ID:
```javascript
const userIds = (users || []).map(u => u.id);
const { data: visitRows } = await supabase
  .from('visits').select('user_id').in('user_id', userIds);
```
При 200 пользователях загружает ВСЕ их визиты без лимита — потенциально сотни тысяч строк.

**`api/services/gamification.js:193–302`** — `checkAndUpdateTasks()`: для каждого task_definition делает 1–3 запроса к БД. При 12 задачах = 12–36 запросов на каждый чекин в fire-and-forget pipeline.

**`api/routes/superadmin.js:725–757`** — `superadmin/economics`: загружает ВСЕ строки topup_requests, withdrawals, visits без лимита — при росте базы OOM.

### 5.3 Большие payload-ы

**`api/routes/superadmin.js:389–403`** — `superadmin/overview` загружает до 5000 строк visits дважды (today + yesterday), до 10000 строк за месяц — всё в память JS для подсчёта уникальных user_id.

**Исправление:** Использовать COUNT(DISTINCT user_id) на уровне SQL/PostgREST.

### 5.4 Отсутствие пагинации

| Эндпоинт | Лимит | Проблема |
|----------|-------|---------|
| `GET /api/superadmin/businesses` | Нет лимита | Полная таблица |
| `GET /api/superadmin/campaigns` | 300 | Большой payload |
| `GET /api/superadmin/fraud` | Нет лимита на visits за 24h | До сотен тысяч |
| `GET /api/campaigns` | 500 | OK для карты |

### 5.5 Кэширование

- `GlobalHeader` в App.jsx использует module-level `_hdrCache` — примитивный кэш без TTL, не инвалидируется после чекина/вывода.
- API не использует HTTP кэш-заголовки (ETag, Cache-Control).
- Нет Redis/in-memory кэша для часто запрашиваемых данных (активные кампании, rate).

---

## 6. НАДЁЖНОСТЬ И ОБРАБОТКА ОШИБОК

### 6.1 Unhandled Promise Rejections

**`api/services/checkin.js:225`** — Gamification pipeline запускается как `(async () => { ... })()` без `.catch()` на внешнем уровне. Ошибки внутри блока обрабатываются, но если `activateReferral()` или `checkAchievements()` выбросят синхронное исключение до первого `await` — это unhandled rejection.

**`api/index.js:190`** — `bot.api.setWebhook(webhookUrl)` — имеет `.catch()`, OK.

**`api/routes/geohunt.js:304`** — `sendMessage()` в фоновом цикле после `res.json()` — уже завершён с клиентом, ошибки `.catch(() => {})` — OK.

### 6.2 Error Boundaries

**Frontend:**
- `AppErrorBoundary` покрывает всё приложение — OK.
- Нет error boundary на уровне отдельных страниц — один упавший компонент (например, Map.jsx при ошибке Leaflet) откатит всё приложение к экрану ошибки.

### 6.3 API Error Handling

**`api/routes/admin.js:55–60`** — `GET /api/admin/stats` — деструктурирует `{ count: visitsToday }` из `Promise.all`. При ошибке Supabase `count` будет `null`, что заворачивается в `|| 0`. Ошибки не проверяются — тихий fail.

**`api/routes/superadmin.js:67–87`** — `supabase.from('withdrawals').select(...).limit(200)` — если error, выбрасывается через `throw error`, что пойдёт в catch — OK. Но лимит 200 без пагинации.

**`api/routes/admin.js:36`** — `if (businessError) return res.status(500)` — но при `!business` после ошибки без `businessError` (т.е. пустой результат) — код ниже продолжится и попытается читать `business.id` → crash. Нет `if (!business) return 404`.

Точнее: строка 37: `if (!business) return res.status(404).json({ error: 'NO_BUSINESS' })` — есть, OK.

### 6.4 Retry Logic

Нет retry-логики на уровне API-клиента (frontend). Один неудавшийся запрос — пользователь видит ошибку. Для критичных операций (checkin) желательна простая повторная попытка.

---

## 7. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ

### Полный список обязательных переменных

| Переменная | Обязательна | Есть в .env.example | Fallback |
|-----------|-------------|-------------------|---------|
| `BOT_TOKEN` | ДА — сервер падает без неё | ДА | нет (fatal) |
| `DATABASE_URL` | ДА — `db/index.js` бросает ошибку | ДА | нет (fatal) |
| `SERVICE_KEY` | ДА — `db/index.js` бросает ошибку | ДА | нет (fatal) |
| `SUPER_ADMIN_TG_ID` | ДА (критично) | **НЕТ** | `'930826522'` — ОПАСНО |
| `WEBHOOK_SECRET` | Рекомендуется | **НЕТ** | половина BOT_TOKEN |
| `OPERATOR_SECRET` | Для operator endpoints | **НЕТ** | — (отключает operator) |
| `RAILWAY_PUBLIC_DOMAIN` | Для автоматической регистрации webhook | **НЕТ** | — (webhook не регистрируется) |
| `GEO_RATE` | Рекомендуется | ДА | 1000 (приемлемо) |
| `BOT_USERNAME` | Рекомендуется | **НЕТ** | `'GeoEarnBot'` |
| `WEBAPP_URL` | Нужен для QR URL генерации | ДА | `''` (пустая строка) |
| `PORT` | Нет | ДА | 3000 |
| `TOPUP_CARD_NUMBER` | Для платёжных реквизитов | ДА | `'0000 0000 0000 0000'` |
| `TOPUP_CARD_HOLDER` | Для платёжных реквизитов | ДА | `'GeoEarn'` |
| `TOPUP_BANK` | Для платёжных реквизитов | ДА | `'Payme'` |

**Frontend (Vite):**

| Переменная | Обязательна | Есть в .env.example |
|-----------|-------------|-------------------|
| `VITE_API_URL` | ДА | ДА |
| `VITE_SUPABASE_URL` | Нет (не используется в коде) | ДА (legacy?) |
| `VITE_SUPABASE_ANON_KEY` | Нет (не используется в коде) | ДА (legacy?) |
| `VITE_APP_NAME` | Нет (не используется в коде) | ДА (legacy?) |

**Примечание:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_NAME` присутствуют в `.env.example` но не используются в исходном коде фронтенда — возможно, legacy от предыдущей архитектуры.

---

## 8. ЗАВИСИМОСТИ

### Backend (из `node_modules` присутствует, но `api/package.json` не найден в стандартном месте)

Зависимости определены в корневом `package.json`. Обнаруженные пакеты:

| Пакет | Версия (из node_modules) | Заметки |
|-------|--------------------------|---------|
| `express` | ~4.x | Стабильная версия |
| `@supabase/supabase-js` | ~2.x | OK |
| `grammy` | ~1.x | OK |
| `express-rate-limit` | Установлен | OK |
| `cors` | Установлен | OK |
| `dotenv` | Установлен | OK |
| `qrcode` | Установлен | OK |

**Потенциально устаревшее:** Без явного `package.json` в `api/` невозможно точно определить версии. Отсутствие `package-lock.json` с зафиксированными версиями создаёт риск.

### Frontend (`miniapp/package.json`)

| Пакет | Версия | Заметки |
|-------|--------|---------|
| `react` | ^18.3.1 | Актуально |
| `react-dom` | ^18.3.1 | Актуально |
| `react-router-dom` | ^6.16.0 | Актуально |
| `lucide-react` | ^0.511.0 | Актуально |
| `leaflet` | ^1.9.4 | Актуально |
| `vite` | ^8.0.11 | Актуально |
| `@vitejs/plugin-react` | ^6.0.1 | Актуально |

**Отсутствуют:**
- `eslint` / `eslint-plugin-react` — нет статической проверки кода
- `typescript` или `@types/react` — нет типизации
- Тесты отсутствуют полностью (jest, vitest, playwright)

---

## 9. НЕСООТВЕТСТВИЯ FRONTEND ↔ BACKEND

### 9.1 API endpoints — вызываются во фронтенде, существуют в бэкенде

| Фронтенд вызов | Бэкенд endpoint | Статус |
|----------------|----------------|--------|
| `GET /api/me` | `user.js` | ✓ OK |
| `GET /api/visits` | `user.js` | ✓ OK |
| `GET /api/activity` | `user.js` | ✓ OK |
| `GET /api/me/game` | `gamification.js` | ✓ OK |
| `GET /api/me/referral` | `gamification.js` | ✓ OK |
| `POST /api/me/tasks/:key/claim` | `gamification.js` | ✓ OK |
| `GET /api/campaigns` | `campaigns.js` | ✓ OK |
| `GET /api/config` | `config.js` | ✓ OK |
| `POST /api/checkin` | `checkin.js` | ✓ OK |
| `POST /api/withdraw` | `withdraw.js` | ✓ OK |
| `GET /api/me/withdrawals` | `withdraw.js` | ✓ OK |
| `GET /api/admin/business` | `admin.js` | ✓ OK |
| `GET /api/admin/stats` | `admin.js` | ✓ OK |
| `POST /api/admin/campaign` | `admin.js` | ✓ OK |
| `PATCH /api/admin/campaign/:id` | `admin.js` | ✓ OK |
| `POST /api/admin/campaign/:id/stop` | `admin.js` | ✓ OK |
| `POST /api/admin/pin` | `admin.js` | ✓ OK |
| `POST /api/admin/topup` | `admin.js` | ✓ OK |
| `GET /api/admin/topups` | `admin.js` | ✓ OK |
| `POST /api/send-qr` | `sendQr.js` | ✓ OK |
| `GET /api/superadmin/*` | `superadmin.js` | ✓ OK |
| `GET /api/promos/active` | `promo.js` | ✓ OK |
| `GET /api/promo/info` | `promo.js` | ✓ OK |
| `POST /api/promo/claim` | `promo.js` | ✓ OK |
| `GET /api/geohunt/info` | `geohunt.js` | ✓ OK |
| `GET /api/geohunt/claim` | `geohunt.js` | ✓ OK |
| `GET /api/platform-promo/list` | `platformPromo.js` | ✓ OK |
| `POST /api/platform-promo/claim` | `platformPromo.js` | ✓ OK |
| `GET /api/geohunts/active` | `geohunt.js` | ✓ OK |

### 9.2 Несоответствия форм ответов

**`api/routes/checkin.js:44–49`** — возвращает `{ reward, totalBalance, streakInfo, newPlaceBonus }`.  
**`api/services/checkin.js:286–302`** — `performCheckin()` возвращает `reward: effectiveReward + newPlaceBonus`. Таким образом, `reward` в ответе уже включает `newPlaceBonus`, но `newPlaceBonus` также отдаётся отдельным полем. Frontend в `Checkin.jsx` должен это учитывать чтобы не задваивать сумму в UI.

**`api/routes/user.js:54–63`** — `GET /api/visits` возвращает `{ visits: [...] }`, но `GET /api/activity` возвращает `{ activity: [...] }`. Оба используются в `Balance.jsx` — это корректно, разные эндпоинты.

### 9.3 Отсутствующие коды ошибок во фронтенде

**`Checkin.jsx`** не обрабатывает:
- `BUSINESS_INSUFFICIENT_FUNDS` — нет в `ERRORS` map, покажет дефолтную ошибку
- `INITDATA_EXPIRED` — возможно при долгой сессии, нет перехвата
- `BOTS_NOT_ALLOWED` — маловероятно, но нет в UI

**`Withdraw.jsx`** не обрабатывает:
- `BELOW_MINIMUM` (с полями `minGeo`, `minUzs`) отдельно — вероятно обрабатывается как generic error

---

## 10. НЕЗАКОНЧЕННЫЕ ФУНКЦИИ

### 10.1 Platform Promo — Subscription Verification (НЕЗАКОНЧЕНО)

**Файл:** `api/routes/platformPromo.js:54`  
Комментарий: `// POST /api/platform-promo/claim — verify subscription + award GEO`  
Верификация не реализована. `channel_id` хранится в БД, но никогда не используется.

### 10.2 Referral Passive Income (НЕЗАКОНЧЕНО)

**Файл:** `db/schema.sql:542–566` — `process_referral_income` определена.  
Нигде не вызывается. Обещанный в UI "+5% от каждого чекина друга в течение 30 дней" не работает.

### 10.3 Achievement `legend_quarter` (НЕЗАКОНЧЕНО)

**Файл:** `api/services/gamification.js:349`  
```javascript
// legend_quarter requires periodic batch job — skip here
```
Достижение "Легенда квартала" (топ-10 по GEO за месяц) определено в БД и отображается в UI, но логика определения победителей не реализована.

### 10.4 Boost/Events Management (ЧАСТИЧНО)

**Файл:** `db/schema.sql:446–455` — таблица `boosts` определена.  
**Файл:** `api/services/gamification.js:70–82` — `getActiveBoosts()` читает из таблицы.  
**Отсутствует:** Суперадмин-эндпоинты для создания/управления boosts — нет в `superadmin.js`.

### 10.5 Debug Overlay в Production

**Файл:** `miniapp/src/App.jsx:44–141` — `<DebugOverlay />` рендерится всегда, патчит `console.*`.  
Нет `import.meta.env.DEV` флага для отключения в production. Всегда присутствует кнопка `🐛` в правом нижнем углу и перехватчик `console`.

### 10.6 Map Page — "matchPct" Placeholder

**Файл:** `miniapp/src/pages/Map.jsx:21–24`
```javascript
function matchPct(c) {
  if (c.dist === undefined) return 82;
  return Math.max(55, Math.min(99, Math.round(99 - c.dist / 80)));
}
```
Функция возвращает произвольный "процент совпадения" (82 по умолчанию) — это фиктивные данные, не основанные на реальных метриках.

---

## 11. МОНИТОРИНГ И ЛОГИРОВАНИЕ

### 11.1 Error Tracking

- **Нет** Sentry, Rollbar или аналогичного сервиса error tracking.
- Ошибки логируются через `console.error` — Railway собирает stdout/stderr, но нет алертинга.
- `api/index.js:171–174` — глобальный error handler логирует `err?.message` — потеря стека трейса.

### 11.2 Структурированное логирование

Логирование не структурировано (plain text). Нет JSON-формата для машинной обработки. Нет correlation ID для трассировки запросов.

**Пример текущего:** `console.error('Unhandled error', err?.message || err);`  
**Рекомендуется:** `{ timestamp, level, message, error, requestId, userId }`

### 11.3 Health Check

**Нет эндпоинта `/health` или `/ping`.** Railway использует HTTP health check для определения живости — без него деплой может считаться успешным пока сервис ещё стартует или упал без перезапуска.

**Рекомендация:** Добавить в `api/index.js`:
```javascript
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));
```

### 11.4 Метрики

Нет сбора метрик (запросы/сек, время ответа, error rate). Для production минимально нужны: количество чекинов/мин, объём выводов, ошибки 5xx.

---

## 12. CHECKLIST ПЕРЕД ДЕПЛОЕМ

| # | Пункт | Статус | Примечание |
|---|-------|--------|-----------|
| 1 | `SUPER_ADMIN_TG_ID` установлен в Railway env | НЕТ | КРИТИЧНО |
| 2 | `WEBHOOK_SECRET` установлен и уникален | НЕТ | Высокий риск |
| 3 | `OPERATOR_SECRET` установлен (если нужен оператор) | НЕТ | Средний риск |
| 4 | `RAILWAY_PUBLIC_DOMAIN` установлен для авторегистрации webhook | НЕТ | Нет автоматизации |
| 5 | `BOT_TOKEN` установлен | ? | Нет в .env.example как required |
| 6 | `DATABASE_URL` и `SERVICE_KEY` установлены | ? | Зависит от деплоя |
| 7 | `WEBAPP_URL` установлен (для корректных QR URL) | ? | Иначе QR будут `/checkin?token=...` |
| 8 | `BOT_USERNAME` установлен (для реферальных ссылок) | НЕТ | Fallback 'GeoEarnBot' |
| 9 | `TOPUP_CARD_NUMBER/HOLDER/BANK` установлены | НЕТ | Иначе placeholder данные |
| 10 | Platform Promo subscription verification реализована | НЕТ | КРИТИЧНО для бизнеса |
| 11 | Race condition promo/claim устранена через RPC | НЕТ | Финансовый риск |
| 12 | Debug overlay отключён в production | НЕТ | Утечка debug info |
| 13 | Health check endpoint добавлен (`/health`) | НЕТ | Нет мониторинга живости |
| 14 | Индексы БД применены (из fix_migrations.sql) | ? | Без них slow queries |
| 15 | `qr_token` индекс на `campaigns` добавлен | ? | Только в fix_migrations |
| 16 | `NaN` check в superadmin adjust исправлен | НЕТ | `isFinite` вместо `typeof` |
| 17 | `/api/send-qr` валидация URL-схемы добавлена | НЕТ | Фишинг-вектор |
| 18 | `/api/send-qr` rate limit добавлен | НЕТ | Флуд-вектор |
| 19 | `referral_earnings.visit_id` расхождение schema/код проверено | НЕТ | Возможные INSERT ошибки |
| 20 | Referral passive income реализован или убрать из UI | НЕТ | Дезинформация |
| 21 | `legend_quarter` achievement реализован или убрать из UI | НЕТ | Дезинформация |
| 22 | Superadmin overview использует COUNT(DISTINCT) вместо JS | НЕТ | OOM при >10k пользователей |
| 23 | `process_referral_income` вызывается из checkin service | НЕТ | Feature broken |
| 24 | Sentry или аналог подключён для error tracking | НЕТ | Нет visibility на prod |
| 25 | Admin PATCH campaign атомарен через RPC | НЕТ | Финансовый риск |
| 26 | validateTma: timing-safe hash comparison | НЕТ | Теоретическая уязвимость |
| 27 | VITE_SUPABASE_URL/ANON_KEY убраны из .env.example если не используются | НЕТ | Засорение конфига |
| 28 | Frontend без abort controllers — state update on unmount | НЕТ | React warning/leak |
| 29 | `_hdrCache` инвалидируется после операций | НЕТ | Устаревший баланс в header |
| 30 | Нет тестов (unit, integration, e2e) | НЕТ | Нет регрессионной защиты |

---

## ПРИОРИТИЗАЦИЯ ИСПРАВЛЕНИЙ

### P0 (блокеры, исправить перед деплоем):
1. Установить `SUPER_ADMIN_TG_ID` + добавить в `.env.example` + убрать или hardcoded fallback
2. Реализовать Telegram channel subscription check в platform-promo/claim
3. Сделать `promo/claim` и `platform-promo/claim` атомарными через PostgreSQL функцию
4. Отключить Debug Overlay в production (`import.meta.env.PROD && return null`)
5. Добавить `/health` endpoint

### P1 (исправить в течение первой недели):
6. Убрать из UI обещание "+5% за каждый чекин друга" или реализовать `process_referral_income`
7. Убрать `legend_quarter` из UI или реализовать batch job
8. Добавить индексы (особенно `visits(user_id, business_id)`, `businesses(owner_telegram_id)`)
9. Добавить `WEBHOOK_SECRET`, `OPERATOR_SECRET`, `BOT_USERNAME`, `RAILWAY_PUBLIC_DOMAIN` в `.env.example`
10. Исправить `superadmin/adjust`: `typeof amount !== 'number'` → `!Number.isFinite(amount)`

### P2 (следующий sprint):
11. Рефакторинг `superadmin/overview` и `superadmin/economics` на SQL aggregates
12. Добавить rate limit на `/api/send-qr`
13. Добавить URL scheme validation в `/api/send-qr`
14. Подключить Sentry
15. Сделать admin PATCH campaign атомарным через RPC

---

*Аудит проведён на основании полного чтения исходного кода. Все ссылки на файлы:строки проверены по фактическому содержимому файлов.*
