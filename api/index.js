const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const { webhookCallback } = require('grammy');
const checkinRoutes = require('./routes/checkin');
const checkinInfoRoutes = require('./routes/checkinInfo');
const userRoutes = require('./routes/user');
const withdrawRoutes = require('./routes/withdraw');
const campaignsRoutes = require('./routes/campaigns');
const adminRoutes = require('./routes/admin');
const operatorRoutes = require('./routes/operator');
const configRoutes = require('./routes/config');
const superadminRoutes   = require('./routes/superadmin');
const gamificationRoutes = require('./routes/gamification');

dotenv.config();

const app = express();

// Railway / Nginx proxy — trust X-Forwarded-For from the first hop
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=()');
  // Remove header that reveals Express
  res.removeHeader('X-Powered-By');
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
// Telegram Mini Apps run in a webview; the Origin header may be:
//   - the WEBAPP_URL origin (Telegram Web / desktop)
//   - the string "null"  (native iOS/Android opaque webview origin)
//   - absent entirely    (server-to-server / bot calls)
// All three cases must be allowed; HMAC-signed initData is the real auth layer.
let WEBAPP_ORIGIN = null;
try {
  if (process.env.WEBAPP_URL) WEBAPP_ORIGIN = new URL(process.env.WEBAPP_URL).origin;
} catch (_) { /* malformed URL — leave null */ }

app.use(cors({
  origin(origin, cb) {
    if (
      !origin ||              // no Origin header (server-to-server, bot)
      origin === 'null' ||   // native Telegram iOS/Android webview opaque origin
      origin === 'https://web.telegram.org' ||
      (WEBAPP_ORIGIN && origin === WEBAPP_ORIGIN) ||
      !WEBAPP_ORIGIN          // WEBAPP_URL not configured — allow all origins
    ) {
      return cb(null, true);
    }
    cb(new Error('CORS_NOT_ALLOWED'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'initData', 'initdata', 'x-operator-secret'],
}));

app.use(express.json({ limit: '64kb' }));

// ── Rate limits ───────────────────────────────────────────────────────────────

// General API rate limit: 120 requests per minute per IP
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

// Checkin: 10 per minute per IP
app.use('/api/checkin', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

// Public QR info endpoint: 30 per minute per IP (stricter — no auth)
app.use('/api/checkin/info', rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

// Withdraw: 5 requests per hour per IP (authenticated, but extra protection)
app.use('/api/withdraw', rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

// Operator endpoints: 60 per minute per IP
app.use('/api/operator', rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

// ── Bot webhook ───────────────────────────────────────────────────────────────
// Use a dedicated WEBHOOK_SECRET env var so the BOT_TOKEN is never in the URL.
// Fallback: use second half of BOT_TOKEN (legacy behaviour, set WEBHOOK_SECRET to rotate).
const { bot } = require('../bot/index');
const webhookSecret = process.env.WEBHOOK_SECRET || process.env.BOT_TOKEN?.split(':')[1] || 'webhook';
app.post(`/bot/${webhookSecret}`, webhookCallback(bot, 'express'));

app.use(checkinRoutes);
app.use(checkinInfoRoutes);
app.use(userRoutes);
app.use(withdrawRoutes);
app.use(campaignsRoutes);
app.use(adminRoutes);
app.use(operatorRoutes);
app.use(configRoutes);
app.use(superadminRoutes);
app.use(gamificationRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err?.message || err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`GeoEarn server started on port ${port}`);

  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (domain) {
    const webhookUrl = `https://${domain}/bot/${webhookSecret}`;
    bot.api.setWebhook(webhookUrl)
      .then(() => console.log(`[bot] webhook registered for domain ${domain}`))
      .catch(err => console.error('[bot] setWebhook failed:', err.message));
  } else {
    console.warn('[bot] RAILWAY_PUBLIC_DOMAIN not set — webhook not registered');
  }
});

module.exports = app;
