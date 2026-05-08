const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');
const { sendMessage } = require('../services/notify');

const router = express.Router();

router.post('/api/withdraw', validateTma, async (req, res) => {
  try {
    const { amount, phone } = req.body;

    if (typeof amount !== 'number' || amount <= 0 || !phone) {
      return res.status(400).json({ error: 'INVALID_PARAMS' });
    }

    const { data, error } = await supabase.rpc('process_withdrawal', {
      p_user_id: req.user.id,
      p_amount: amount,
      p_phone: phone,
    });

    if (error) {
      if (error.message && error.message.includes('INSUFFICIENT_FUNDS')) {
        return res.status(400).json({ error: 'INSUFFICIENT_FUNDS' });
      }
      console.error('withdraw rpc error', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    const row = Array.isArray(data) ? data[0] : data;

    // Fire-and-forget notification
    sendMessage(
      req.user.telegram_id,
      `✅ *Заявка на вывод принята!*\n\n` +
      `💳 Сумма: *${amount.toLocaleString('ru-RU')} сум*\n` +
      `📱 Payme: \`${phone}\`\n\n` +
      `Средства поступят в течение 24 часов.\n` +
      `Остаток баланса: *${row.new_balance.toLocaleString('ru-RU')} сум*`
    ).catch(() => {});

    return res.json({ status: 'pending', totalBalance: row.new_balance });
  } catch (error) {
    console.error('POST /api/withdraw error', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
