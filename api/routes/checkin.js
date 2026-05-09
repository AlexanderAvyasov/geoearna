const express = require('express');
const validateTma = require('../middleware/validateTma');
const antifraud = require('../middleware/antifraud');
const { performCheckin } = require('../services/checkin');
const { sendMessage } = require('../services/notify');

const router = express.Router();

router.post('/api/checkin', validateTma, antifraud, async (req, res) => {
  try {
    const { qrToken, lat, lng, pin } = req.body;

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
      pin: pin || null,
    });

    // Fire-and-forget Telegram notification
    const xpGained = 10 + (result.newPlaceBonus > 0 ? 20 : 0);
    const streakLine = result.streakInfo.projected > 1
      ? `🔥 Стрик: *${result.streakInfo.projected} дн.*\n`
      : '';
    sendMessage(
      req.user.telegram_id,
      `✅ *+${result.reward.toLocaleString('ru-RU')} GEO* получено!\n\n` +
      `📍 ${result.businessName}\n` +
      `${streakLine}` +
      `⚡ +${xpGained} XP\n` +
      `💰 Баланс: *${result.totalBalance.toLocaleString('ru-RU')} GEO*`
    ).catch(() => {});

    return res.json({ reward: result.reward, totalBalance: result.totalBalance });
  } catch (error) {
    const code = error && error.code ? error.code : 'INTERNAL_ERROR';
    const clientErrors = ['TOO_FAR', 'INVALID_PARAMS', 'INVALID_QR_TOKEN', 'NO_ACTIVE_CAMPAIGN', 'BUSINESS_INSUFFICIENT_FUNDS', 'PIN_REQUIRED', 'INVALID_PIN', 'PIN_USED', 'PIN_EXPIRED'];
    const status = code === 'TOO_SOON' ? 429 : clientErrors.includes(code) ? 400 : 500;
    return res.status(status).json({ error: code });
  }
});

module.exports = router;
