    # GeoEarn

    Платформа геолояльности внутри Telegram. Пользователи получают GEO-токены за визиты в кафе, магазины и рестораны — через QR-чекин без установки приложений.

    ---

    ## Стек

    | Слой | Технология | Версия |
    |------|-----------|--------|
    | **Runtime** | Node.js | 18+ |
    | **API** | Express | 4.18 |
    | **Bot** | Grammy (Telegram Bot API) | 1.15 |
    | **Frontend** | React + Vite | 18 / 8 |
    | **Роутинг** | React Router | v6 |
    | **Карта** | Leaflet | 1.9 |
    | **Иконки** | lucide-react | 0.511 |
    | **БД** | PostgreSQL (Supabase) | 15 |
    | **Auth** | HMAC-SHA256 Telegram initData | — |
    | **Хостинг API** | Railway | — |
    | **Хостинг фронтенда** | Vercel | — |

    ---

    ## Что уже работает

    ### Пользователи
    - [x] Чекин через QR-сканирование с геоверификацией на сервере
    - [x] GEO-кошелёк: баланс, история транзакций
    - [x] Вывод средств GEO → UZS на карту (ручное одобрение)
    - [x] Онбординг (приветственный флоу)
    - [x] Интерактивная карта партнёров (Leaflet)
    - [x] Реферальная программа (уникальные ссылки, 1000 GEO рефереру)
    - [x] Promo QR Hunt (токены с редкостью: common / rare / epic / legendary)
    - [x] GeoHunt (географические квесты с кодами)

    ### Геймификация
    - [x] 10 уровней прогрессии (Novice → Legend) с множителями 1.0× – 1.25×
    - [x] Дневные стрики + бонусы на 7 / 14 / 30 день
    - [x] Заморозка стрика — 1 пропуск в неделю без сброса серии
    - [x] 12 заданий (ежедневные, еженедельные, разовые)
    - [x] 6 достижений за реальное поведение
    - [x] Буст-события с временным множителем до 1.5×

    ### Для бизнеса (личный кабинет в Mini App)
    - [x] Создание кампании: бюджет → авторасчёт награды и лимита
    - [x] PIN-верификация (6 цифр, TTL 15 мин) против фиктивных чекинов
    - [x] Уникальный QR-код на каждую кампанию
    - [x] Автоостановка кампании при нехватке баланса
    - [x] Статистика: сегодня / 7 дней / предыдущие 7 дней
    - [x] Запрос пополнения баланса через оператора

    ### Суперадмин
    - [x] Dashboard: выручка platform_wallet, активные пользователи, объём выводов
    - [x] Управление пользователями: бан/разбан, коррекция баланса
    - [x] Одобрение/отклонение выводов с аудит-логом
    - [x] Управление курсом GEO → UZS
    - [x] Создание/редактирование промо-кампаний
    - [x] Платформенные кампании за счёт накопленных комиссий

    ### Безопасность
    - [x] HMAC-SHA256 верификация initData (timing-safe сравнение)
    - [x] Защита от replay-атак (проверка `auth_date`, TTL 24 ч)
    - [x] 10 атомарных PostgreSQL RPC-функций — нет race conditions
    - [x] Rate limiting на всех уязвимых endpoint'ах (10–120 req/min)
    - [x] Haversine геопроверка на сервере (клиенту не доверяем)

    ### Ещё не реализовано
    - [ ] Платёжный шлюз Payme / Click (вывод сейчас ручной)
    - [ ] Форма онбординга бизнеса прямо в Mini App (сейчас ручной ввод в БД)
    - [ ] Push-уведомления (Web Push / Telegram Channel)
    - [ ] CI/CD (GitHub Actions)
    - [ ] Автотесты

    ---

    ## Структура репозитория

    ```
    .
    ├── api/                  # Express backend (62 endpoint'а, 15 route-файлов)
    │   ├── index.js          # Точка входа, регистрация маршрутов
    │   ├── middleware/
    │   │   ├── validateTma.js  # HMAC-SHA256 auth
    │   │   └── antifraud.js    # Rate limit + гео-проверка
    │   ├── routes/           # checkin, user, campaigns, admin, superadmin ...
    │   └── services/         # checkin, geo, gamification, notify
    ├── bot/                  # Telegram-бот (Grammy)
    │   ├── index.js
    │   ├── handlers/         # start, balance, history, withdraw, myqr, mypin
    │   └── tasks/            # streak, weekly, monthly, reengagement, missions
    ├── db/
    │   ├── index.js          # Supabase client
    │   ├── schema.sql        # 20 таблиц + 10 RPC-функций
    │   └── migrations/       # Инкрементальные миграции
    ├── miniapp/              # React SPA (Telegram Mini App)
    │   ├── src/
    │   │   ├── pages/        # 12 страниц
    │   │   ├── components/
    │   │   ├── hooks/        # useTelegram, useLocation
    │   │   ├── lib/          # api, geo, i18n, design
    │   │   └── contexts/     # LanguageContext (RU/UZ/EN)
    │   ├── vite.config.js
    │   └── vercel.json
    ├── scripts/
    │   └── generate-qr.js    # CLI генерация QR для партнёра
    ├── .env.example
    ├── railway.toml
    └── start.js              # Запускает api + bot одновременно
    ```

    ---

    ## Локальный запуск

    ### Предварительно

    - Node.js 18+
    - Аккаунт [Supabase](https://supabase.com) (бесплатный tier)
    - Telegram-бот через [@BotFather](https://t.me/BotFather)

    ### 1. Клонировать и установить зависимости

    ```bash
    git clone <repo-url>
    cd CreditMiniAPP

    # Backend + Bot
    npm install

    # Frontend
    cd miniapp && npm install && cd ..
    ```

    ### 2. Настроить переменные окружения

    ```bash
    cp .env.example .env
    ```

    Заполнить `.env` (см. раздел [Переменные окружения](#переменные-окружения)).

    ### 3. Инициализировать базу данных

    В Supabase SQL Editor выполнить последовательно:

    ```sql
    -- Основная схема (таблицы + RPC-функции)
    \i db/schema.sql

    -- Начальные данные (уровни, достижения, задания)
    \i scripts/seed.sql
    ```

    Или через psql:

    ```bash
    psql "$DATABASE_URL" -f db/schema.sql
    psql "$DATABASE_URL" -f scripts/seed.sql
    ```

    ### 4. Запустить

    **Вариант A — всё сразу:**
    ```bash
    node start.js
    ```

    **Вариант B — раздельно (удобно для отладки):**
    ```bash
    # Терминал 1 — API
    node api/index.js

    # Терминал 2 — Bot
    node bot/index.js

    # Терминал 3 — Frontend
    cd miniapp && npm run dev
    ```

    Frontend запустится на `http://localhost:5173`, API на `http://localhost:3000`.

    > Прокси `/api → localhost:3000` настроен в `miniapp/vite.config.js`, ничего дополнительно не нужно.

    ### 5. Зарегистрировать webhook (для бота)

    При локальной разработке нужен публичный URL (например, через [ngrok](https://ngrok.com)):

    ```bash
    ngrok http 3000
    # Скопировать https://xxxx.ngrok.io
    ```

    Webhook регистрируется автоматически при запуске, если задана `RAILWAY_PUBLIC_DOMAIN`. Для ngrok установить эту переменную в `.env`:

    ```
    RAILWAY_PUBLIC_DOMAIN=xxxx.ngrok.io
    ```

    ---

    ## Деплой на Railway + Vercel

    ### Backend (Railway)

    1. Создать проект на [railway.app](https://railway.app)
    2. Добавить все переменные из `.env.example` в Railway Variables
    3. Указать команду запуска: `node start.js` (уже в `railway.toml`)
    4. Задеплоить:

    ```bash
    npm install -g @railway/cli
    railway login
    railway up
    ```

    Railway автоматически зарегистрирует webhook бота при наличии `RAILWAY_PUBLIC_DOMAIN`.

    ### Frontend (Vercel)

    ```bash
    cd miniapp
    npm install -g vercel
    vercel --prod
    ```

    В Vercel добавить переменные:
    - `VITE_API_URL` — URL вашего Railway-сервиса
    - `VITE_SUPER_ADMIN_TG_ID` — Telegram ID суперадмина

    Файл `vercel.json` уже настроен для SPA-роутинга.

    ### Настройка Mini App в BotFather

    1. Открыть [@BotFather](https://t.me/BotFather) → `/newapp`
    2. Указать URL задеплоенного Vercel-приложения
    3. Убедиться, что `WEBAPP_URL` в `.env` совпадает с этим URL

    ---

    ## Переменные окружения

    | Переменная | Обязательна | Описание |
    |-----------|:-----------:|---------|
    | `BOT_TOKEN` | Да | Токен бота от @BotFather |
    | `DATABASE_URL` | Да | URL Supabase-проекта (`https://xxx.supabase.co`) |
    | `SERVICE_KEY` | Да | Service Role Key из Supabase Settings → API |
    | `SUPER_ADMIN_TG_ID` | Да | Telegram ID суперадмина (сервер не стартует без него) |
    | `WEBHOOK_SECRET` | Рекомендуется | Случайная строка для пути webhook'а |
    | `BOT_USERNAME` | Рекомендуется | @username бота (для реферальных ссылок) |
    | `RAILWAY_PUBLIC_DOMAIN` | Рекомендуется | Домен Railway — авторегистрация webhook |
    | `WEBAPP_URL` | Рекомендуется | URL фронтенда (для QR-кодов) |
    | `VITE_API_URL` | Да (фронтенд) | URL backend API |
    | `VITE_SUPER_ADMIN_TG_ID` | Да (фронтенд) | Telegram ID суперадмина |
    | `OPERATOR_SECRET` | Нет | Ключ для B2B operator endpoint'ов |
    | `GEO_RATE` | Нет | UZS за 1 GEO (по умолчанию `1000`) |
    | `TOPUP_CARD_NUMBER` | Нет | Реквизиты для пополнения бизнесами |
    | `TOPUP_CARD_HOLDER` | Нет | Имя держателя карты |
    | `TOPUP_BANK` | Нет | Название банка |
    | `PORT` | Нет | Порт API (по умолчанию `3000`) |

    ---

    ## Генерация QR для партнёра

    ```bash
    # Установить BOT_USERNAME в .env, затем:
    node scripts/generate-qr.js ТОКЕН_ЗАВЕДЕНИЯ
    ```

    QR-код сохраняется в `qr-codes/`. Токен заведения находится в таблице `businesses.qr_token`.

    ---

    ## Мониторинг (SQL-запросы)

    ```sql
    -- Чекины за сегодня
    SELECT COUNT(*) AS visits_today
    FROM visits
    WHERE created_at >= CURRENT_DATE;

    -- Pending-выводы для ручной обработки
    SELECT id, user_id, amount, phone, created_at
    FROM withdrawals
    WHERE status = 'pending'
    ORDER BY created_at ASC;

    -- Топ-10 пользователей по визитам
    SELECT u.username, u.telegram_id, COUNT(v.id) AS visit_count
    FROM users u
    JOIN visits v ON v.user_id = u.id
    GROUP BY u.id, u.username, u.telegram_id
    ORDER BY visit_count DESC
    LIMIT 10;

    -- Баланс platform_wallet
    SELECT balance FROM platform_wallet WHERE id = 1;

    -- Активные кампании с остатком бюджета
    SELECT b.name, c.reward_amount, c.budget,
        (c.budget - c.visits_count * c.reward_amount) AS remaining
    FROM campaigns c
    JOIN businesses b ON b.id = c.business_id
    WHERE c.active = true;
    ```

    ---

    ## База данных: ключевые таблицы

    | Таблица | Назначение |
    |---------|-----------|
    | `users` | Пользователи (telegram_id, balance, level, streak) |
    | `businesses` | Партнёрские заведения (координаты, qr_token, owner) |
    | `campaigns` | Кампании вознаграждений (бюджет, радиус, PIN) |
    | `visits` | Лог всех чекинов (аудит-трейл) |
    | `withdrawals` | Заявки на вывод GEO → UZS |
    | `platform_wallet` | Накопленные комиссии платформы |
    | `platform_transactions` | Аудит комиссионных операций |
    | `promo_campaigns` | Promo QR Hunt кампании |
    | `geohunts` / `geohunt_codes` | GeoHunt квесты |
    | `user_levels` | 10 уровней с множителями наград |
    | `user_streaks` | Дневные стрики пользователей |
    | `missions` / `user_missions` | Задания и прогресс |
    | `achievements` / `user_achievements` | Достижения |
    | `support_tickets` | Обращения в поддержку |

    **Атомарные RPC-функции** (нет race conditions на финансовых операциях):
    `process_checkin`, `create_campaign_with_commission`, `process_withdrawal`, `approve_withdrawal`, `reject_withdrawal`, `claim_promo`, `claim_geohunt`, `update_streak`, `complete_mission`, `confirm_topup`
