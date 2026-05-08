# GeoEarn

GeoEarn — пилотный проект с backend, Telegram-ботом и мини-приложением.

## Установка и запуск

1. Клонируйте репозиторий:

```bash
git clone <repo-url>
cd CreditMiniAPP
```

2. Установите зависимости для бэкенда и бота:

```bash
npm install
```

3. Создайте файл `.env` на основе `.env.example` и заполните переменные:

```bash
cp .env.example .env
```

4. Разверните базу данных:

```bash
psql -f db/schema.sql
psql -f scripts/seed.sql
```

Если вы используете `DATABASE_URL`, можно выполнить:

```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f scripts/seed.sql
```

5. Запустите бэкенд и Telegram-бота локально:

```bash
node api/index.js
node bot/index.js
```

6. Запустите мини-приложение:

```bash
cd miniapp
npm install
npm run dev
```

## Деплой backend на Railway

1. Установите Railway CLI и войдите:

```bash
npm install -g railway
railway login
```

2. Инициализируйте проект или создайте сервис:

```bash
railway init
```

3. Добавьте переменные окружения в Railway:

- `BOT_TOKEN`
- `BOT_USERNAME`
- `DATABASE_URL`
- `SERVICE_KEY`
- `PORT` (например `3000`)
- `WEBAPP_URL`

4. Установите команду запуска:

```bash
node api/index.js & node bot/index.js
```

5. Запустите деплой:

```bash
railway up
```

## Деплой Mini App на Vercel

1. Войдите в Vercel:

```bash
npm install -g vercel
vercel login
```

2. Перейдите в папку мини-приложения и задеплойте:

```bash
cd miniapp
vercel
```

3. При необходимости используйте `vercel --prod` для продакшн-деплоя.

## Настройка Mini App в BotFather

1. Создайте новое приложение через @BotFather: `/newapp`
2. Укажите URL вашего мини-приложения.
3. Убедитесь, что WebApp URL совпадает с `WEBAPP_URL` в `.env`.

## Генерация QR-кода для заведения

1. Установите `BOT_USERNAME` в `.env`.
2. Запустите скрипт:

```bash
node scripts/generate-qr.js ТОКЕН_ЗАВЕДЕНИЯ
```

3. QR-код будет сохранён в папке `qr-codes/`.

## Тестирование пилота

1. Распечатайте QR-код.
2. Разместите его на стойке заведения.
3. Откройте QR-код в Telegram и проверьте чекин.

## Мониторинг пилота

- Количество визитов за сегодня:

```sql
SELECT COUNT(*) AS visits_today
FROM visits
WHERE created_at >= CURRENT_DATE;
```

- Список pending выводов, которые нужно обработать вручную:

```sql
SELECT id, user_id, amount, phone, created_at
FROM withdrawals
WHERE status = 'pending'
ORDER BY created_at ASC;
```

- Топ пользователей по количеству визитов:

```sql
SELECT u.id, u.username, u.telegram_id, COUNT(v.id) AS visit_count
FROM users u
JOIN visits v ON v.user_id = u.id
GROUP BY u.id, u.username, u.telegram_id
ORDER BY visit_count DESC
LIMIT 10;
```
