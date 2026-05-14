const express = require('express');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const validateTma = require('../middleware/validateTma');
const { sendPhoto } = require('../services/notify');

const router = express.Router();

const sendQrLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_REQUESTS' },
});

router.post('/api/send-qr', sendQrLimit, validateTma, async (req, res) => {
  const { url, caption } = req.body;
  if (!url || typeof url !== 'string' || url.length > 2000) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }
  // Only allow https:// URLs to prevent phishing / javascript: injection
  if (!/^https:\/\//i.test(url)) {
    return res.status(400).json({ error: 'INVALID_URL_SCHEME' });
  }

  try {
    const buffer = await QRCode.toBuffer(url, { width: 600, margin: 3 });
    await sendPhoto(req.user.telegram_id, buffer, caption || '🔲 *QR-код GeoEarn*');
    return res.json({ ok: true });
  } catch (err) {
    console.error('[send-qr] error', err?.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
