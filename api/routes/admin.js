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

// Create top-up request
router.post('/api/admin/topup', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;
  const { amount } = req.body;

  if (typeof amount !== 'number' || amount < 10000) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (businessError) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  if (!business) return res.status(403).json({ error: 'NOT_OWNER' });

  const { data: request, error: insertError } = await supabase
    .from('topup_requests')
    .insert({ business_id: business.id, amount })
    .select('id, amount, created_at')
    .single();

  if (insertError) return res.status(500).json({ error: 'INTERNAL_ERROR' });

  return res.json({
    request,
    paymentDetails: {
      cardNumber: process.env.TOPUP_CARD_NUMBER || '0000 0000 0000 0000',
      cardHolder: process.env.TOPUP_CARD_HOLDER || 'GeoEarn',
      bank: process.env.TOPUP_BANK || 'Payme',
      amount,
      comment: `GeoEarn #${request.id}`,
    },
  });
});

// Top-up history for business
router.get('/api/admin/topups', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (businessError) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  if (!business) return res.status(403).json({ error: 'NOT_OWNER' });

  const { data: requests, error } = await supabase
    .from('topup_requests')
    .select('id, amount, status, note, created_at, processed_at')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  return res.json({ requests: requests || [] });
});

module.exports = router;
