const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');

const router = express.Router();

router.get('/api/admin/business', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, address, balance, qr_token, campaigns(id, reward_amount, visits_count, max_visits, active, requires_pin, task_type, task_description)')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  if (!business) return res.status(404).json({ error: 'NO_BUSINESS' });

  return res.json({ business });
});

router.post('/api/admin/pin', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (businessError) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  if (!business) return res.status(403).json({ error: 'NOT_OWNER' });

  const pin = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase
    .from('verification_pins')
    .insert({ business_id: business.id, pin, expires_at: expiresAt });

  if (insertError) return res.status(500).json({ error: 'INTERNAL_ERROR' });

  return res.json({ pin, expiresAt });
});

module.exports = router;
