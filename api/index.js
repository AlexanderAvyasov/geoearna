const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
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
const promoRoutes        = require('./routes/promo');
const platformPromoRoutes = require('./routes/platformPromo');
const geohuntRoutes      = require('./routes/geohunt');
const sendQrRoutes       = require('./routes/sendQr');
const supportRoutes      = require('./routes/support');
const adminAuthRoutes    = require('./routes/adminAuth');

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
// Telegram Mini Apps run in a webview with unpredictable Origin values:
//   - the WEBAPP_URL origin   (Telegram Web / desktop)
//   - the string "null"       (native iOS/Android opaque webview)
//   - absent entirely         (server-to-server / bot calls)
//
// CORS is a browser-only mechanism and is NOT the security layer here.
// Real auth = HMAC-signed initData verified in validateTma on every write endpoint.
// Therefore: allow all origins. Blocking by origin would only break legitimate
// Telegram clients whose origin we can't predict across versions and platforms.
app.use(cors({
  origin(origin, cb) {
    // Opaque webview origin — browsers reject ACAO: null, use wildcard instead.
    if (origin === 'null') return cb(null, '*');
    // All other origins (including absent) — reflect back or allow freely.
    cb(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'initData', 'initdata', 'x-operator-secret', 'Authorization'],
}));

app.use(express.json({ limit: '64kb' }));

// ── Health check (before rate limiting so Railway probes never get throttled) ──
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

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

// Promo claim: 10 per minute per IP (same as checkin)
app.use('/api/promo/claim', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

// Promo info: 30 per minute per IP
app.use('/api/promo/info', rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

// Platform promo claim: 10 per minute per IP
app.use('/api/platform-promo/claim', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

// GeoHunt claim: 10 per minute per IP
app.use('/api/geohunt/claim', rateLimit({
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
app.use(promoRoutes);
app.use(platformPromoRoutes);
app.use(geohuntRoutes);
app.use(sendQrRoutes);
app.use(supportRoutes);
app.use(adminAuthRoutes);

// ── Web Admin SPA ─────────────────────────────────────────────────────────────
// Serve the built admin panel at /admin/*
// Run `cd admin && npm run build` before deploying to populate admin/dist.
const adminDist = path.join(__dirname, '..', 'admin', 'dist');
app.use('/admin', express.static(adminDist));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(adminDist, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err?.message || err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

const port = process.env.PORT || 3000;

// Startup safety checks
if (!process.env.BOT_TOKEN) {
  console.error('[FATAL] BOT_TOKEN is not set — Telegram auth will fail for all users');
  process.exit(1);
}
if (!process.env.SUPER_ADMIN_TG_ID) {
  console.error('[FATAL] SUPER_ADMIN_TG_ID is not set — refusing to start without explicit admin ID');
  process.exit(1);
}
if (!process.env.WEBHOOK_SECRET)  console.warn('[WARN] WEBHOOK_SECRET not set — webhook path derived from BOT_TOKEN; set WEBHOOK_SECRET to rotate safely');
if (!process.env.OPERATOR_SECRET) console.warn('[WARN] OPERATOR_SECRET not set — operator topup endpoints are disabled');

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
