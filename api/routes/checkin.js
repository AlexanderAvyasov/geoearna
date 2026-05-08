const express = require('express');
const validateTma = require('../middleware/validateTma');
const antifraud = require('../middleware/antifraud');
const { performCheckin } = require('../services/checkin');

const router = express.Router();

router.post('/api/checkin', validateTma, antifraud, async (req, res) => {
  try {
    const { qrToken, lat, lng } = req.body;

    if (!qrToken || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'INVALID_PARAMS' });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'INVALID_PARAMS' });
    }

    const result = await performCheckin({
      userId: req.user.id,
      qrToken,
      lat,
      lng,
    });

    return res.json(result);
  } catch (error) {
    const code = error && error.code ? error.code : 'INTERNAL_ERROR';
    const status = code === 'TOO_SOON' ? 429 : ['TOO_FAR', 'INVALID_PARAMS', 'INVALID_QR_TOKEN', 'NO_ACTIVE_CAMPAIGN', 'BUSINESS_INSUFFICIENT_FUNDS'].includes(code) ? 400 : 500;
    return res.status(status).json({ error: code });
  }
});

module.exports = router;
