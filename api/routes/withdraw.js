const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');
const { sendMessage } = require('../services/notify');
const { getGeoRate } = require('../lib/geoRate');

const router = express.Router();

const CARD_RE = /^\d{16}$/;

router.post('/api/withdraw', validateTma, async (req, res) => {
  try {
    const { amount, phone: rawCard } = req.body;

    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'INVALID_PARAMS' });
    }

    const cardNumber = String(rawCard || '').replace(/[\s\-]/g, '');
    if (!CARD_RE.test(cardNumber)) {
      return res.status(400).json({ error: 'INVALID_CARD' });
    }

    const geoRate = getGeoRate();
    const MIN_UZS = 50_000;
    if (amount * geoRate < MIN_UZS) {
      return res.status(400).json({
        error: 'BELOW_MINIMUM',
        minGeo: Math.ceil(MIN_UZS / geoRate),
        minUzs: MIN_UZS,
      });
    }

    const { data, error } = await supabase.rpc('process_withdrawal', {
      p_user_id: req.user.id,
      p_amount:  amount,
      p_phone:   cardNumber,
    });

    if (error) {
      if (error.message && error.message.includes('INSUFFICIENT_FUNDS')) {
        return res.status(400).json({ error: 'INSUFFICIENT_FUNDS' });
      }
      console.error('withdraw rpc error', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    const row = Array.isArray(data) ? data[0] : data;
    const uzsAmount = Math.round(amount * geoRate);
    const maskedCard = `**** **** **** ${cardNumber.slice(-4)}`;

    sendMessage(
      req.user.telegram_id,
      `✅ *Заявка на вывод принята!*\n\n` +
      `💎 GEO: *${amount.toLocaleString('ru-RU')} GEO*\n` +
      `💵 К выплате: *${uzsAmount.toLocaleString('ru-RU')} UZS*\n` +
      `💳 Карта: \`${maskedCard}\`\n\n` +
      `Средства поступят в течение 24 часов.\n` +
      `Остаток: *${row.new_balance.toLocaleString('ru-RU')} GEO*`
    ).catch(() => {});

    return res.json({
      status: 'pending',
      totalBalance: row.new_balance,
      uzsAmount,
      geoRate,
    });
  } catch (error) {
    console.error('POST /api/withdraw error', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/api/me/withdrawals', validateTma, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('id, amount, phone, status, created_at, processed_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return res.json({ withdrawals: data || [] });
  } catch (err) {
    console.error('GET /api/me/withdrawals error', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
