const express = require('express');
const QRCode = require('qrcode');
const validateTma = require('../middleware/validateTma');
const { sendPhoto } = require('../services/notify');

const router = express.Router();

router.post('/api/send-qr', validateTma, async (req, res) => {
  const { url, caption } = req.body;
  if (!url || typeof url !== 'string' || url.length > 2000) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
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
