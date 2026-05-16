# GeoEarn — Полный аудит приложения
**Дата:** 2026-05-16

---

## 1. ОБЩАЯ АРХИТЕКТУРА

**GeoEarn** — Telegram Mini App для монетизации локального бизнеса через геолокационные чекины.

### Стек
| Слой | Технология |
|------|-----------|
| Бэкенд | Node.js + Express |
| База данных | PostgreSQL (Supabase) |
| Фронтенд | React + Vite |
| Хостинг API | Railway |
| Хостинг фронтенда | Cloudflare Pages |
| Бот | Grammy (Telegram Bot API) |
| Валюта | GEO (игровая) / UZS (фиат) |

### Компоненты
1. **API Backend** — Express, 15 route-файлов
2. **Telegram Bot** — уведомления и webhooks
3. **Mini App Frontend** — полноценный React SPA
4. **PostgreSQL** — ~27 таблиц в Supabase
5. **Gamification Engine** — стрики, уровни, XP, достижения, задачи
6. **Платформенный кошелёк** — `platform_wallet` (один ряд, id=1)

---

## 2. РОЛИ ПОЛЬЗОВАТЕЛЕЙ

### 2.1 Обычный пользователь
**Определение:** любой Telegram-аккаунт, открывший Mini App.

**Возможности:**
- Сканировать QR → получать GEO
- Участвовать в Promo QR и GeoHunt
- Выполнять задачи, открывать достижения
- Приглашать друзей (реферальная система)
- Выводить GEO в UZS на карту

**Проверка роли на бэкенде:**
```js
// validateTma.js — middleware, выполняется на каждом запросе
// Проверяет HMAC-подпись Telegram initData
// Находит/создаёт запись в users по telegram_id
// Кладёт req.user = { id, telegram_id, balance, banned_at, ... }
```

---

### 2.2 Бизнес-владелец (Owner)
**Определение:** `businesses.owner_telegram_id` совпадает с telegram_id юзера.

**Возможности:**
- Управлять кампаниями (создать, остановить, продлить)
- Пополнять баланс бизнеса (topup-запросы)
- Генерировать PIN для верификации
- Просматривать статистику визитов

**Проверка на бэкенде:**
```js
// api/routes/admin.js
const { data: business } = await supabase
  .from('businesses')
  .select('id')
  .eq('owner_telegram_id', req.telegramUser.id)
  .maybeSingle();
if (!business) return res.status(403).json({ error: 'FORBIDDEN' });
```

---

### 2.3 Супер-Администратор (SA)
**Определение:** `SUPER_ADMIN_TG_ID` из Railway env — единственный аккаунт.

**Возможности:** полный контроль платформы (см. раздел 11).

**Проверка на бэкенде:**
```js
// api/routes/superadmin.js
function requireSuperAdmin(req, res, next) {
  if (String(req.user.telegram_id) !== process.env.SUPER_ADMIN_TG_ID) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  next();
}
```

**Проверка на фронтенде:**
```js
// /api/me возвращает is_super_admin: true/false
// SuperAdmin.jsx и Profile.jsx используют этот флаг
const is_super_admin = SA_TG_ID > 0 && Number(user.telegram_id) === SA_TG_ID;
```

---

## 3. СИСТЕМА GEO

### Что такое GEO?
Внутренняя валюта платформы. Пользователи получают её за активность и выводят в реальные деньги.

**Курс:** `1 GEO = GEO_RATE UZS` (env-переменная, по умолчанию 1000 UZS/GEO)

### Откуда берётся GEO?

| Источник | Кто платит | Получатель | Сумма |
|----------|-----------|------------|-------|
| Базовая награда чекина | Бизнес (`businesses.balance`) | Пользователь | `campaign.reward_amount` |
| Множитель уровня | Платформа (`platform_wallet`) | Пользователь | (levelMult−1) × base |
| Множитель стрика | Платформа | Пользователь | (1.5−1) × base при 7/14/30 дн |
| Буст / Happy Hour | Платформа | Пользователь | (boostMult−1) × base |
| Бонус нового места | Платформа | Пользователь | +100 GEO (бизнес < 7 дней) |
| Milestone стрика | Платформа | Пользователь | 7д:500 / 14д:1500 / 30д:5000 |
| Задачи | Платформа | Пользователь | 5–120 GEO |
| Достижения | Платформа | Пользователь | 25–1000 GEO |
| Реферальный бонус (активация) | Платформа | Реферер | +25 GEO |
| Реферальный бонус (новый юзер) | Платформа | Новый юзер | +10 GEO |
| Пассивный доход | Платформа | Реферер | 5% от каждого чекина реферала (30 дней) |
| Promo QR | Платформа | Пользователь | `promo_campaigns.reward_amount` |
| GeoHunt код | Платформа | Пользователь | `geohunts.reward_per_code` |

### Откуда пополняется platform_wallet?
- **Комиссия 5%** при создании кампании бизнесом
- **Комиссия 10%** при топапе бизнесом (идёт в кошелёк платформы как прибыль)
- Ручное пополнение SA: `UPDATE platform_wallet SET balance = balance + N WHERE id = 1`

---

## 4. ЧЕКИН: ПОЛНЫЙ FLOW

### Шаг 1 — Сканирование QR
Пользователь сканирует QR → открывается `/checkin?token=...&cid=...`

### Шаг 2 — Аутентификация (`validateTma` middleware)
```
1. Проверить наличие заголовка initdata
2. HMAC-SHA256 подпись (secretKey = HMAC(BOT_TOKEN, "WebAppData"))
3. auth_date не старше 24 часов (replay protection)
4. Не бот (is_bot === false)
5. Найти/создать users запись по telegram_id
6. Проверить banned_at — если забанен → 403
```

### Шаг 3 — Антифрод (`antifraud` middleware)
```
Был ли чекин в ЭТОМ бизнесе за последние 24 часа?
→ Да: 429 TOO_SOON
→ Нет: продолжить
```

### Шаг 4 — Поиск QR токена
```
Сначала: campaign-level QR (campaigns.qr_token)
Если нет: business-level QR (businesses.qr_token)
Если нет: 400 INVALID_QR_TOKEN
```

### Шаг 5 — Валидация кампании
```
campaign.active = true
campaign.ends_at > now (или null)
campaign.visits_count < campaign.max_visits
businesses.balance >= campaign.reward_amount
```

### Шаг 6 — Проверка геолокации
```js
const distance = getDistance(userPos, businessPos); // Haversine formula
if (distance > business.radius_m) throw 'TOO_FAR';  // обычно radius_m = 500м
```

### Шаг 7 — PIN (если campaign.requires_pin = true)
```
Проверить verification_pins WHERE business_id=... AND pin=... 
→ Не найден: INVALID_PIN
→ used=true: PIN_USED
→ expires_at < now: PIN_EXPIRED
→ Всё ок: UPDATE pin SET used=true
```

### Шаг 8 — Вычисление множителей
```js
// Уровневый бонус
levelMult = user.level.bonus  // 1.00 (lvl1) → 1.25 (lvl10)

// Стрик-бонус
streakMult = [7,14,30].includes(projectedStreak) ? 1.5 : 1.0

// Буст (DB или Happy Hour)
boostMult = max(activeBoosts.multiplier, happyHour ? 2.0 : 1.0)
// Happy Hour: пятница 12:00–14:00 Ташкент

// Бонус нового места
newPlaceBonus = (бизнес открыт < 7 дней назад) ? 100 : 0

// Итого
effectiveReward = round(baseReward * levelMult * streakMult * boostMult)
platformBonus   = effectiveReward - baseReward + newPlaceBonus
```

### Шаг 9 — Атомарный чекин (PostgreSQL RPC)
```sql
-- process_checkin() — всё в одной транзакции
INSERT INTO visits (user_id, business_id, campaign_id, lat, lng, rewarded=baseReward)
UPDATE campaigns SET visits_count = visits_count + 1
UPDATE businesses SET balance = balance - baseReward
UPDATE users    SET balance = balance + baseReward
-- Если баланс бизнеса упал ниже следующей награды → деактивировать кампании
```

### Шаг 10 — Платформенный бонус
```js
// apply_checkin_bonus() RPC
// Платит за множители и newPlaceBonus
if (platformBonus > 0)
  UPDATE platform_wallet SET balance = balance - platformBonus
  UPDATE users SET balance = balance + platformBonus
```

### Шаг 11 — Реферальный пассивный доход (fire-and-forget)
```js
// process_referral_income() RPC
// Если у пользователя есть реферер И прошло ≤ 30 дней с активации:
earning = max(1, floor(baseReward * 0.05))
UPDATE platform_wallet SET balance = balance - earning
UPDATE users SET balance = balance + earning  -- реферер
INSERT referral_earnings (referrer_id, referred_id, visit_id, amount)
```

### Шаг 12 — Геймификация (fire-and-forget, асинхронно)
```
1. applyStreakUpdate()  — обновить стрик, проверить milestone
2. grantXp()           — +10 base, +20 (first visit to biz), +5 (streak updated)
3. checkAchievements() — разблокировать достижения
4. checkAndUpdateTasks() — обновить прогресс задач
5. Telegram-уведомления (level-up, milestone, achievement)
```

### Шаг 13 — Ответ + Telegram-уведомление
```
Ответ клиенту: { reward, totalBalance, streakInfo, levelInfo, newPlaceBonus }

Telegram уведомление (fire-and-forget):
✅ *+{reward} GEO* получено!
📍 {businessName}
🔥 Стрик: *{N} дн.* (если > 1)
⚡ +{xpGained} XP
💰 Баланс: *{totalBalance} GEO*
```

---

## 5. ГЕЙМИФИКАЦИЯ

### 5.1 Стрики

| Поле | Описание |
|------|---------|
| `current_streak` | Текущая серия (дней подряд) |
| `longest_streak` | Максимальный достигнутый |
| `last_checkin_date` | Дата последнего чекина (игровой день Ташкент) |
| `freeze_available` | Кол-во "заморозок" (0–2) |

**Правила:**
- 1 чекин в игровой день → +1 стрик
- Пропуск дня → стрик = 1 (если нет freeze)
- При пропуске + наличии freeze → стрик сохраняется, freeze уменьшается на 1
- При стрике ≥ 7 → +1 freeze (макс 1)
- При стрике ≥ 14 → freeze = 2 (макс)

**Игровой день (Ташкент):** чекины до 02:00 Ташкента засчитываются предыдущему дню
```js
const TASHKENT_MS = 5 * 60 * 60 * 1000;  // UTC+5
const GRACE_MS    = 2 * 60 * 60 * 1000;  // 2-часовой grace период
const gameDay = new Date(Date.now() + TASHKENT_MS - GRACE_MS).toISOString().slice(0,10);
```

**Milestone бонусы:**
| Стрик | Бонус GEO |
|-------|-----------|
| 7 дней | 500 |
| 14 дней | 1500 |
| 30 дней | 5000 |

---

### 5.2 Уровни и XP

| Level | Название | Min XP | Бонус |
|-------|----------|--------|-------|
| 1 | Новичок | 0 | 1.00× |
| 2 | Исследователь | 100 | 1.02× |
| 3 | Постоянный | 250 | 1.05× |
| 4 | Активный | 500 | 1.08× |
| 5 | Эксперт | 1000 | 1.10× |
| 6 | Мастер | 2000 | 1.12× |
| 7 | Ветеран | 3000 | 1.15× |
| 8 | Элита | 3750 | 1.18× |
| 9 | Чемпион | 4500 | 1.20× |
| 10 | Легенда | 5000 | 1.25× |

**Источники XP:**
| Событие | XP |
|---------|----|
| Чекин | +10 |
| Первый визит в бизнес | +20 |
| Обновление стрика (не повторный) | +5 |
| Задача выполнена | 5–50 |
| Достижение открыто | 10–200 |

---

### 5.3 Задачи (Tasks)

**Ежедневные** (сбрасываются каждый игровой день):

| Key | Условие | GEO | XP |
|-----|---------|-----|-----|
| `daily_1_checkin` | ≥1 чекин | 5 | 5 |
| `daily_2_places` | ≥2 разных бизнеса | 20 | 15 |
| `daily_before_noon` | чекин до 12:00 Ташкент | 10 | 10 |
| `daily_3_checkins` | ≥3 чекина | 25 | 20 |
| `daily_new_place` | первый визит в новый бизнес | 15 | 10 |

**Еженедельные** (сбрасываются каждый понедельник):

| Key | Условие | GEO | XP |
|-----|---------|-----|-----|
| `weekly_5_places` | ≥5 бизнесов за неделю | 75 | 50 |
| `weekly_streak_7` | стрик 7 дней | 100 | 30 |
| `weekly_15_checkins` | ≥15 чекинов | 120 | 50 |
| `weekly_3_categories` | 3 разных task_type | 50 | 25 |

**Одноразовые** (навсегда):

| Key | Условие | GEO | XP |
|-----|---------|-----|-----|
| `onetime_first` | первый чекин | 15 | 10 |
| `onetime_withdrawal` | первый вывод | 25 | 15 |
| `onetime_referral` | первый активированный реферал | 50 | 20 |

---

### 5.4 Достижения (Achievements)

| Key | Название | Условие | GEO | XP |
|-----|----------|---------|-----|-----|
| `pioneer` | Первооткрыватель | 10 разных бизнесов | 100 | 25 |
| `unbreakable` | Несломленный | стрик 30 дней | 500 | 100 |
| `recruiter` | Рекрутёр | 5 активированных рефералов | 300 | 75 |
| `early_bird` | Ранняя пташка | 7 чекинов до 12:00 (Ташкент) | 80 | 40 |
| `loyal` | Преданный | 10 визитов в 1 бизнес | 100 | 50 |
| `legend_quarter` | Легенда квартала | топ-10 за месяц | 1000 | 200 |

---

### 5.5 Бусты (Boosts)

Таблица `boosts` — SA устанавливает вручную:

| Поле | Тип | Описание |
|------|-----|---------|
| `multiplier` | DECIMAL(4,2) | 1.0–2.0 |
| `starts_at`, `ends_at` | TIMESTAMPTZ | Период |
| `filter` | JSONB | `{"business_ids":[...]}` или пусто (все) |
| `active` | BOOLEAN | Включён ли |

**Happy Hour (встроенный):**
- День: пятница
- Время: 12:00–14:00 (Ташкент UTC+5)
- Множитель: ×2.0

---

## 6. PROMO QR

Специальные QR, размещённые в физических точках. Пользователи сканируют → получают GEO.

**Таблицы:** `promo_campaigns`, `promo_claims`

**Ограничения:**
- Дневной лимит: **3 promo-клейма в день** (на пользователя)
- `cooldown_hours = 0` → только один раз за всю жизнь
- `cooldown_hours = N` → раз в N часов
- `max_claims` → максимум всего для всех

**Рарити (только для UI):**
| Рарити | Цвет |
|--------|------|
| `common` | серый #9CA3AF |
| `rare` | синий #60A5FA |
| `epic` | фиолетовый #C084FC |
| `legendary` | золотой #FBBF24 |

**Создание:** SA через `POST /api/superadmin/promo-campaigns`
**Клейм:** `POST /api/promo/claim` (требует геолокацию + радиус `radius_m`)

---

## 7. GEOHUNT (ОХОТА ЗА КОДАМИ)

Разбросанные по городу физические QR-коды. Пользователи находят → сканируют → получают GEO.

**Таблицы:** `geohunts` (UUID PK), `geohunt_codes` (UUID PK)

**Как работает:**
1. SA создаёт hunt: `POST /api/sa/geohunts` → система генерирует N кодов с токенами `gh_...`
2. SA получает QR-изображения в Telegram
3. SA распечатывает и размещает QR в городе
4. Пользователь находит QR, сканирует → `GET /api/geohunt/claim?token=gh_xxx`
5. Код помечается `used_by=userId, used_at=now`
6. Пользователь получает `hunt.reward_per_code` GEO из `platform_wallet`

**Проверки:**
- Код существует и не использован (`used_by IS NULL`)
- Hunt активна (`active=true`, `started_at < now`, `ends_at > now`)
- Пользователь не заблокирован

---

## 8. РЕФЕРАЛЬНАЯ СИСТЕМА

**Таблицы:** `referrals`, `referral_earnings`

### Flow

1. **Создание ссылки:** каждый пользователь → код `ref_{id}`, ссылка через бота
2. **Переход:** новый юзер открывает Mini App через реферальную ссылку → `referrals(referrer_id, referred_id, activated=false)`
3. **Активация (при ПЕРВОМ чекине реферала):**
   - Реферер получает **+25 GEO**
   - Реферал получает **+10 GEO**
   - Запись: `activated=true, passive_until=now()+30дней`
4. **Пассивный доход (30 дней после активации):**
   - При каждом чекине реферала → реферер получает **5% от base_reward** (минимум 1 GEO)

**Ограничения:**
- Реферальная ссылка не активируется если прошло > 7 дней
- Пассивный доход строго 30 дней

---

## 9. ВЫВОД СРЕДСТВ

**Таблица:** `withdrawals`

### Flow

**Пользователь:**
```
POST /api/withdraw { amount: GEO, phone: "9860XXXXXXXXXXXX" }
Минимум: 50,000 UZS (= 50 GEO при курсе 1000)
→ process_withdrawal() RPC:
  1. SELECT balance FROM users FOR UPDATE
  2. balance -= amount
  3. INSERT withdrawals (status='pending')
```

**SuperAdmin видит список → одобряет:**
```
POST /api/superadmin/withdrawals/:id/approve
→ approve_withdrawal() RPC:
  UPDATE withdrawals SET status='approved', processed_at=NOW()
→ Telegram уведомление юзеру: сумма + карта
→ SA вручную переводит деньги на карту
```

**SuperAdmin отклоняет:**
```
POST /api/superadmin/withdrawals/:id/reject { note: "причина" }
→ reject_withdrawal() RPC:
  UPDATE withdrawals SET status='rejected'
  UPDATE users SET balance = balance + amount  ← деньги возвращаются
→ Telegram уведомление юзеру с причиной
```

---

## 10. БИЗНЕС-КАБИНЕТ

**Доступ:** `businesses.owner_telegram_id = текущий Telegram ID`

### Что может бизнес-владелец

| Действие | Эндпойнт | Описание |
|----------|---------|---------|
| Просмотр | `GET /api/admin/business` | Данные бизнеса + все кампании |
| Статистика | `GET /api/admin/stats` | Визиты сегодня, 7д, пред.7д |
| Создать кампанию | `POST /api/admin/campaign` | `budget + max_visits → reward = budget/visits` |
| Продлить кампанию | `PATCH /api/admin/campaign/:id` | Добавить активации / изменить дату |
| Остановить | `POST /api/admin/campaign/:id/stop` | `active=false` |
| PIN | `POST /api/admin/pin` | 6-значный код, действует 15 минут |
| Топап | `POST /api/admin/topup` | Запрос пополнения баланса |
| История топапов | `GET /api/admin/topups` | Статус запросов |

### Экономика кампании
```
reward_amount = floor(budget / max_visits)
commission    = max(ceil(reward_amount * 0.05), 1)   ← идёт в platform_wallet
totalCharged  = reward_amount * max_visits + commission
```

### Топап бизнеса
```
grossGeo     = floor(uzsAmount / geoRate)
commission   = floor(grossGeo * 0.10)                ← 10% за топап
netGeo       = grossGeo - commission
→ platform_wallet += commission
→ businesses.balance += netGeo (после подтверждения SA)
```

---

## 11. СУПЕР-АДМИНИСТРАТОР

### 11.1 Dashboard / Overview

| Метрика | Описание |
|---------|---------|
| DAU / MAU | Уникальные юзеры за день / месяц (с трендом %) |
| Чекины сегодня | Кол-во за текущий игровой день |
| Ожидают вывода | Кол-во + сумма (GEO) |
| Баланс платформы | `platform_wallet.balance` |
| Бизнесы с нулевым балансом | Требуют внимания |
| Фрод-подозреваемые | > 4 бизнесов за 24ч |

### 11.2 Управление пользователями
- Просмотр топ-пользователей по балансу
- Карточка пользователя: история чекинов + выводов
- **Бан** → `banned_at=now()` → все API вернут 403
- **Анбан** → `banned_at=null`
- **Корректировка баланса** (+ или −) с логированием в `sa_audit_log`

### 11.3 Управление бизнесами
- Список всех бизнесов с балансами
- **Подвеска**: деактивировать все кампании + `suspended_at=now()`
- **Возобновление**: `suspended_at=null`

### 11.4 Управление кампаниями
- Список всех кампаний (+ аномалии: `reward > 5000`)
- Редактировать любую кампанию
- Toggle `active`
- **Платформенная кампания**: платформа финансирует кампанию за бизнес

### 11.5 Выводы средств
- Список `status=pending` выводов
- Одобрить / отклонить (с возвратом GEO при отклонении)
- Уведомления пользователям в Telegram

### 11.6 Топапы бизнесов
- Список `status=pending` топапов
- Подтвердить → `businesses.balance += amount`

### 11.7 Promo QR
- Список всех promo-кампаний (остаток, истечение, статус)
- Создать / деактивировать

### 11.8 GeoHunt
- Создать hunt → сгенерировать N кодов
- Отправить QR-изображения в Telegram
- Toggle active / просмотр кодов

### 11.9 Экономика платформы
```
totalRevenue  = сумма подтверждённых топапов (UZS)
totalPayout   = сумма одобренных выводов (GEO → UZS)
margin        = totalRevenue - totalPayout
platformBalance = platform_wallet.balance (GEO)
```

### 11.10 Курс GEO / Конфиг
- Изменить `GEO_RATE` через `POST /api/superadmin/config/rate`
- История изменений курса в `geo_rate_history`

### 11.11 Фрод-детектор
```
Подозрительные за 24 часа:
HIGH:   > 4 разных бизнеса  ИЛИ  > 8 визитов
MEDIUM: > 2 разных бизнеса  ИЛИ  > 4 визита
```

### 11.12 Аудит-лог
Все SA-действия пишутся в `sa_audit_log`:
`campaign_edit`, `platform_campaign_create`, `user_ban/unban`, `geo_credit/debit`, `business_suspend/unsuspend`, `rate_change`, `promo_multi_claim`

---

## 12. АНТИФРОД И БЕЗОПАСНОСТЬ

| Защита | Механизм |
|--------|---------|
| Аутентификация | HMAC-SHA256 Telegram initData на каждом запросе |
| Replay attack | `auth_date` не старше 24 часов |
| Боты | `is_bot=true` → 401 |
| Бан | `banned_at IS NOT NULL` → 403 на всех эндпойнтах |
| Антифрод чекин | 1 визит в бизнес за 24 часа (per user per business) |
| Геолокация | Расстояние Haversine ≤ `business.radius_m` |
| PIN | 6 цифр, одноразовый, истекает через 15 минут |
| Rate limiting | 120/мин общий, 10/мин чекин, 5/час вывод |
| SQL-инъекции | Только Supabase ORM, нет строковой интерполяции |
| Security headers | nosniff, X-Frame-Options: DENY, Referrer-Policy |
| SA-роуты | `requireSuperAdmin` middleware на всех `/api/superadmin/*` |
| Атомарность | Все финансовые операции через PostgreSQL RPC с `FOR UPDATE` |

---

## 13. ПОЛНЫЙ СПИСОК API ENDPOINTS

### Публичные (без авторизации)
```
GET  /health                             — Статус сервера
GET  /api/config                         — geoRate, currency
GET  /api/campaigns                      — Активные кампании (карта)
GET  /api/promos/active                  — Активные Promo QR
GET  /api/promo/info?token=              — Инфо о Promo QR
GET  /api/geohunts/active                — Активные GeoHunt
GET  /api/geohunt/info?token=            — Инфо о GeoHunt коде
GET  /api/checkin/info?token=            — Инфо о QR токене
```

### Пользователь (`validateTma`)
```
GET  /api/me                             — Текущий юзер + is_super_admin
GET  /api/visits                         — История визитов (10 шт)
GET  /api/activity                       — Unified feed (визиты+промо+геохант)
GET  /api/me/withdrawals                 — История выводов
GET  /api/me/game                        — Gamification данные
POST /api/me/tasks/:key/claim            — Клеймить задачу
GET  /api/me/referral                    — Реферальные данные

POST /api/checkin                        — Чекин по QR
POST /api/promo/claim                    — Клейм Promo QR
GET  /api/geohunt/claim?token=           — Клейм GeoHunt кода (GET)
POST /api/geohunt/claim                  — Клейм GeoHunt кода (POST)
POST /api/withdraw                       — Инициировать вывод
```

### Бизнес-владелец (owner check)
```
GET  /api/admin/business                 — Данные бизнеса + кампании
GET  /api/admin/stats                    — Статистика визитов
POST /api/admin/pin                      — Генерировать PIN
POST /api/admin/campaign                 — Создать кампанию
PATCH /api/admin/campaign/:id            — Продлить/изменить
POST /api/admin/campaign/:id/stop        — Остановить
POST /api/admin/topup                    — Запросить топап
GET  /api/admin/topups                   — История топапов
```

### SuperAdmin (`requireSuperAdmin`)
```
GET  /api/superadmin/stats               — Dashboard
GET  /api/superadmin/overview            — Extended (DAU/MAU/fraud)
GET  /api/superadmin/fraud               — Фрод-подозреваемые

GET  /api/superadmin/users               — Топ пользователей
GET  /api/superadmin/users/:id/card      — Профиль юзера
POST /api/superadmin/users/:id/ban
POST /api/superadmin/users/:id/unban
POST /api/superadmin/users/:id/adjust    — Корректировка баланса

GET  /api/superadmin/businesses          — Все бизнесы
POST /api/superadmin/businesses/:id/suspend
POST /api/superadmin/businesses/:id/unsuspend

GET  /api/superadmin/campaigns           — Все кампании
PATCH /api/superadmin/campaigns/:id
POST /api/superadmin/campaigns/:id/toggle
POST /api/superadmin/platform-campaign   — Платформенная кампания

GET  /api/superadmin/withdrawals         — Выводы (pending)
POST /api/superadmin/withdrawals/:id/approve
POST /api/superadmin/withdrawals/:id/reject

GET  /api/superadmin/topups              — Топапы (pending)
POST /api/superadmin/topups/:id/confirm

GET  /api/superadmin/promo-campaigns
POST /api/superadmin/promo-campaigns

GET  /api/superadmin/platform-config
POST /api/superadmin/config/rate         — Изменить курс GEO

GET  /api/superadmin/economics           — Unit economics

GET  /api/sa/geohunts
POST /api/sa/geohunts
PATCH /api/sa/geohunts/:id
GET  /api/sa/geohunts/:id/codes
POST /api/sa/geohunts/:id/send-qr
```

---

## 14. ФРОНТЕНД СТРАНИЦЫ

| Путь | Страница | Что делает |
|------|----------|-----------|
| `/` | Home | Список активных кампаний / promo / geohunt; фильтры |
| `/checkin?token=` | Checkin | QR flow: геолокация → PIN → анимация награды |
| `/balance` | Balance | Баланс GEO, история (visits + promo + geohunt), курс |
| `/withdraw` | Withdraw | Форма вывода: карта + сумма, валидация |
| `/game` | Game | Стрик, XP/уровень, задачи, достижения, рефералы |
| `/admin` | Admin | Бизнес-кабинет (кампании, статистика, топап, QR, PIN) |
| `/superadmin` | SuperAdmin | Панель SA (все данные платформы) |
| `/profile` | Profile | Имя, баланс, стрик, XP, язык, поддержка, кнопка SA |
| `/map` | Map | Интерактивная карта бизнесов и promo-точек (Leaflet) |
| `/onboarding` | Onboarding | Первый запуск (туториал) |
| `/legal` | Legal | Условия использования |
| `/channel-reward` | ChannelSub | Награда за подписку на канал |

**Навбар (5 вкладок):**
```
Главная | Игра | [Scan QR] | Баланс | SA / Бизнес / Профиль
```
- Последняя вкладка: SA (если is_super_admin) → Бизнес (если isOwner) → Профиль (иначе)

---

## 15. ВСЕ КЛЮЧЕВЫЕ КОНСТАНТЫ

### Награды
| Константа | Значение | Где |
|-----------|---------|-----|
| `GEO_RATE` | 1000 UZS/GEO (env) | geoRate.js |
| `REFERRAL_BONUS_REFERRER` | 25 GEO | checkin.js |
| `REFERRAL_BONUS_NEW_USER` | 10 GEO | checkin.js |
| `referral_passive_rate` | 5% от base | process_referral_income() |
| `newPlaceBonus` | 100 GEO | gamification.js |
| `MILESTONE_GEO[7]` | 500 GEO | gamification.js |
| `MILESTONE_GEO[14]` | 1500 GEO | gamification.js |
| `MILESTONE_GEO[30]` | 5000 GEO | gamification.js |

### Лимиты и таймауты
| Константа | Значение | Где |
|-----------|---------|-----|
| `ANTIFROD_COOLDOWN` | 24 часа (per biz) | antifraud.js |
| `INITDATA_TTL` | 24 часа | validateTma.js |
| `PIN_TTL` | 15 минут | admin.js |
| `REFERRAL_WINDOW` | 7 дней (для активации) | checkin.js |
| `PASSIVE_INCOME_DAYS` | 30 дней | process_referral_income() |
| `DAILY_CLAIM_LIMIT` | 3 promo/день | promo.js |
| `NEW_PLACE_WINDOW` | 7 дней (возраст бизнеса) | gamification.js |
| `MIN_UZS_WITHDRAWAL` | 50,000 UZS | withdraw.js |

### Комиссии
| Операция | Комиссия | Кому |
|----------|---------|------|
| Создание кампании | 5% от `reward × visits` | platform_wallet |
| Топап бизнеса | 10% от grossGeo | platform_wallet |

### Rate Limits
| Эндпойнт | Лимит | Окно |
|----------|-------|------|
| Общий | 120 req | 60 сек |
| `/api/checkin` | 10 req | 60 сек |
| `/api/promo/claim` | 10 req | 60 сек |
| `/api/promo/info` | 30 req | 60 сек |
| `/api/geohunt/claim` | 10 req | 60 сек |
| `/api/withdraw` | 5 req | 60 мин |

---

*Аудит подготовлен на основе полного чтения кодовой базы. 2026-05-16*
