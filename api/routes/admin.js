const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');

const router = express.Router();

router.get('/api/admin/business', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, address, balance, qr_token, campaigns(id, budget, reward_amount, visits_count, max_visits, active, requires_pin, task_type, task_description, ends_at, created_at)')
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

// Create campaign with budget-based reward formula
router.post('/api/admin/campaign', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;
  const { budget, max_visits, task_type, task_description, requires_pin, ends_at } = req.body;

  if (!Number.isInteger(budget) || budget < 1000) {
    return res.status(400).json({ error: 'INVALID_PARAMS', message: 'budget must be >= 1000' });
  }
  if (!Number.isInteger(max_visits) || max_visits < 1) {
    return res.status(400).json({ error: 'INVALID_PARAMS', message: 'max_visits must be >= 1' });
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id, balance')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (businessError) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  if (!business) return res.status(403).json({ error: 'NOT_OWNER' });
  if (business.balance < budget) return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });

  // (budget - 10%) / activations = reward per activation
  const rewardAmount = Math.floor((budget * 0.9) / max_visits);
  if (rewardAmount < 1) {
    return res.status(400).json({ error: 'REWARD_TOO_LOW', message: 'Increase budget or reduce activations' });
  }

  const commission = budget - rewardAmount * max_visits;

  // Atomically: deduct commission from business balance, credit platform_wallet, insert campaign
  const { data: campaignId, error: rpcError } = await supabase.rpc('create_campaign_with_commission', {
    p_business_id:      business.id,
    p_budget:           budget,
    p_reward_amount:    rewardAmount,
    p_max_visits:       max_visits,
    p_task_type:        task_type || 'visit',
    p_task_description: task_description || null,
    p_requires_pin:     !!requires_pin,
    p_ends_at:          ends_at || null,
  });

  if (rpcError) {
    if (rpcError.message?.includes('INSUFFICIENT_BALANCE')) {
      return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }

  const { data: campaign, error: fetchError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (fetchError) return res.status(500).json({ error: 'INTERNAL_ERROR' });

  return res.json({
    campaign,
    breakdown: {
      budget,
      commission,
      totalToUsers: rewardAmount * max_visits,
      rewardPerActivation: rewardAmount,
    },
  });
});

// Deactivate a campaign
router.post('/api/admin/campaign/:id/stop', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;
  const campaignId = parseInt(req.params.id, 10);

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (!business) return res.status(403).json({ error: 'NOT_OWNER' });

  const { error } = await supabase
    .from('campaigns')
    .update({ active: false })
    .eq('id', campaignId)
    .eq('business_id', business.id);

  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  return res.json({ ok: true });
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
