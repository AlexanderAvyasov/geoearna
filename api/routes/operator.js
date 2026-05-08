const express = require('express');
const { supabase } = require('../../db/index');
const { sendMessage } = require('../services/notify');

const router = express.Router();

function operatorAuth(req, res, next) {
  const secret = process.env.OPERATOR_SECRET;
  if (!secret) return res.status(503).json({ error: 'OPERATOR_NOT_CONFIGURED' });
  const provided = req.headers['x-operator-secret'];
  if (!provided || provided !== secret) return res.status(403).json({ error: 'FORBIDDEN' });
  return next();
}

// List all pending top-up requests
router.get('/api/operator/topups', operatorAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('topup_requests')
    .select('id, amount, status, note, created_at, processed_at, businesses(id, name, owner_telegram_id)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  return res.json({ requests: data });
});

// Confirm a top-up request
router.post('/api/operator/topups/:id/confirm', operatorAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'INVALID_PARAMS' });

  // Get request info before confirming (for notification)
  const { data: request } = await supabase
    .from('topup_requests')
    .select('amount, businesses(name, owner_telegram_id)')
    .eq('id', id)
    .maybeSingle();

  const { error: rpcError } = await supabase.rpc('confirm_topup', { p_request_id: id });

  if (rpcError) {
    if (rpcError.message?.includes('REQUEST_NOT_FOUND')) {
      return res.status(404).json({ error: 'REQUEST_NOT_FOUND' });
    }
    console.error('confirm_topup rpc error', rpcError);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }

  // Notify business owner
  if (request?.businesses?.owner_telegram_id) {
    sendMessage(
      request.businesses.owner_telegram_id,
      `✅ *Баланс пополнен!*\n\n` +
      `💰 Зачислено: *${request.amount.toLocaleString('ru-RU')} сум*\n` +
      `🏪 Заведение: ${request.businesses.name}\n\n` +
      `Можете запускать новые кампании.`
    ).catch(() => {});
  }

  return res.json({ ok: true });
});

// Reject a top-up request
router.post('/api/operator/topups/:id/reject', operatorAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'INVALID_PARAMS' });
  const { note } = req.body;

  const { data: request } = await supabase
    .from('topup_requests')
    .select('amount, businesses(name, owner_telegram_id)')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase
    .from('topup_requests')
    .update({ status: 'rejected', note: note || null, processed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });

  if (request?.businesses?.owner_telegram_id) {
    sendMessage(
      request.businesses.owner_telegram_id,
      `❌ *Заявка на пополнение отклонена*\n\n` +
      `💳 Сумма: ${request.amount.toLocaleString('ru-RU')} сум\n` +
      (note ? `📝 Причина: ${note}\n\n` : '\n') +
      `Свяжитесь с поддержкой GeoEarn для уточнений.`
    ).catch(() => {});
  }

  return res.json({ ok: true });
});

module.exports = router;
