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

app.use(cors());
app.use(express.json());

// General API rate limit: 120 requests per minute per IP
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

// Stricter limit for checkin endpoint: 10 per minute per IP
app.use('/api/checkin', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
}));

// Telegram bot webhook — must be raw (before express.json parses body)
const { bot } = require('../bot/index');
const botSecret = process.env.BOT_TOKEN?.split(':')[1] || 'webhook';
app.post(`/bot/${botSecret}`, webhookCallback(bot, 'express'));

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
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`GeoEarn server started on port ${port}`);

  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (domain) {
    const webhookUrl = `https://${domain}/bot/${botSecret}`;
    bot.api.setWebhook(webhookUrl)
      .then(() => console.log(`[bot] webhook set → ${webhookUrl}`))
      .catch(err => console.error('[bot] setWebhook failed:', err.message));
  } else {
    console.warn('[bot] RAILWAY_PUBLIC_DOMAIN not set — webhook not registered');
  }
});

module.exports = app;
