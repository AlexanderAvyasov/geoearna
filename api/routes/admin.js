const express = require('express');
const crypto = require('crypto');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');
const { getGeoRate } = require('../lib/geoRate');

const router = express.Router();

router.get('/api/admin/business', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, address, balance, qr_token, campaigns(id, budget, reward_amount, visits_count, max_visits, active, requires_pin, task_type, task_description, ends_at, qr_token, created_at)')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (error) {
    console.error('GET /api/admin/business error:', JSON.stringify(error));
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
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

// Business statistics (visits, GEO spent)
router.get('/api/admin/stats', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (!business) return res.status(403).json({ error: 'NOT_OWNER' });

  const now = new Date();
  const startOfToday   = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo   = new Date(now.getTime() - 7  * 86400_000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400_000);

  const [
    { count: visitsToday },
    { count: visits7d },
    { count: visitsPrev7d },
    { data: lastTopup },
  ] = await Promise.all([
    supabase.from('visits').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', startOfToday.toISOString()),
    supabase.from('visits').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', sevenDaysAgo.toISOString()),
    supabase.from('visits').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .gte('created_at', fourteenDaysAgo.toISOString())
      .lt('created_at', sevenDaysAgo.toISOString()),
    supabase.from('topup_requests').select('amount')
      .eq('business_id', business.id).eq('status', 'confirmed')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  return res.json({
    visitsToday:    visitsToday    || 0,
    visits7d:       visits7d       || 0,
    visitsPrev7d:   visitsPrev7d   || 0,
    lastTopupAmount: lastTopup?.amount || null,
  });
});

const VALID_TASK_TYPES = ['visit', 'photo', 'form', 'survey'];

// Create campaign with budget-based reward formula
router.post('/api/admin/campaign', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;
  const { budget, max_visits, task_type, task_description, requires_pin, ends_at } = req.body;

  if (!Number.isInteger(budget) || budget < 1000) {
    return res.status(400).json({ error: 'INVALID_PARAMS', message: 'budget must be >= 1000' });
  }
  if (!Number.isInteger(max_visits) || max_visits < 1 || max_visits > 100000) {
    return res.status(400).json({ error: 'INVALID_PARAMS', message: 'max_visits must be 1–100000' });
  }
  if (task_type !== undefined && !VALID_TASK_TYPES.includes(task_type)) {
    return res.status(400).json({ error: 'INVALID_PARAMS', message: `task_type must be one of: ${VALID_TASK_TYPES.join(', ')}` });
  }
  if (task_description !== undefined && task_description !== null) {
    if (typeof task_description !== 'string' || task_description.length > 500) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'task_description must be a string under 500 chars' });
    }
  }
  if (ends_at !== undefined && ends_at !== null) {
    const endsDate = new Date(ends_at);
    if (isNaN(endsDate.getTime()) || endsDate <= new Date()) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'ends_at must be a future date' });
    }
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id, balance')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (businessError) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  if (!business) return res.status(403).json({ error: 'NOT_OWNER' });

  // RPC computes 5% commission internally; pre-check here with same formula
  const rewardAmount = Math.floor(budget / max_visits);
  if (rewardAmount < 1) {
    return res.status(400).json({ error: 'REWARD_TOO_LOW', message: 'Increase budget or reduce activations' });
  }
  const rewardsSum = rewardAmount * max_visits;
  const commission = Math.max(Math.ceil(rewardsSum * 0.05), rewardsSum > 0 ? 1 : 0);
  const totalCost  = rewardsSum + commission;

  if (business.balance < totalCost) {
    return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
  }

  const campaignQrToken = crypto.randomBytes(24).toString('hex');

  // Atomically: deduct commission → platform_wallet, record campaign; rewards paid per checkin
  const { data: campaignId, error: rpcError } = await supabase.rpc('create_campaign_with_commission', {
    p_business_id:      business.id,
    p_budget:           budget,
    p_reward_amount:    rewardAmount,
    p_max_visits:       max_visits,
    p_task_type:        task_type || 'visit',
    p_task_description: task_description || null,
    p_requires_pin:     !!requires_pin,
    p_ends_at:          ends_at || null,
    p_qr_token:         campaignQrToken,
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
      rewardsPool:         rewardsSum,
      commission,
      totalCharged:        totalCost,
      rewardPerActivation: rewardAmount,
    },
  });
});

// Extend activations or update ends_at for a campaign
router.patch('/api/admin/campaign/:id', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;
  const campaignId = parseInt(req.params.id, 10);
  const { additional_visits, ends_at } = req.body;

  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .select('id, balance')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (bizErr) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  if (!business) return res.status(403).json({ error: 'NOT_OWNER' });

  const { data: campaign, error: campErr } = await supabase
    .from('campaigns')
    .select('id, reward_amount, max_visits, budget')
    .eq('id', campaignId)
    .eq('business_id', business.id)
    .maybeSingle();

  if (campErr) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  if (!campaign) return res.status(404).json({ error: 'NOT_FOUND' });

  const updates = {};
  let extraCost = 0;

  if (Number.isInteger(additional_visits) && additional_visits > 0) {
    extraCost = additional_visits * campaign.reward_amount;
    if (business.balance < extraCost) {
      return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
    }
    updates.max_visits = campaign.max_visits + additional_visits;
    updates.budget = (campaign.budget || 0) + extraCost;
  }

  if (ends_at !== undefined) {
    if (ends_at === null) {
      updates.ends_at = null;
    } else {
      const endsDate = new Date(ends_at);
      if (isNaN(endsDate.getTime()) || endsDate <= new Date()) {
        return res.status(400).json({ error: 'INVALID_PARAMS', message: 'ends_at must be a future date' });
      }
      updates.ends_at = endsDate.toISOString();
    }
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'NOTHING_TO_UPDATE' });
  }

  if (extraCost > 0) {
    // Atomic: only deduct if balance is still sufficient (prevents race condition)
    const { error: deductErr, count: affected } = await supabase
      .from('businesses')
      .update({ balance: business.balance - extraCost }, { count: 'exact' })
      .eq('id', business.id)
      .gte('balance', extraCost);
    if (deductErr) return res.status(500).json({ error: 'INTERNAL_ERROR' });
    if (!affected) return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
  }

  const { error: updateErr } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', campaignId);

  if (updateErr) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  return res.json({ ok: true, extraCost });
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

const TOPUP_COMMISSION = 0.10;
const TOPUP_MIN_UZS    = 10_000;

// Create top-up request — business pays in UZS, gets GEO minus 10% commission
router.post('/api/admin/topup', validateTma, async (req, res) => {
  const telegramId = req.user.telegram_id;
  const { uzsAmount } = req.body;

  if (typeof uzsAmount !== 'number' || !Number.isFinite(uzsAmount) || uzsAmount < TOPUP_MIN_UZS) {
    return res.status(400).json({ error: 'INVALID_PARAMS', message: `Minimum top-up is ${TOPUP_MIN_UZS} UZS` });
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (businessError) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  if (!business) return res.status(403).json({ error: 'NOT_OWNER' });

  const geoRate  = getGeoRate();
  const grossGeo = Math.floor(uzsAmount / geoRate);
  const commission = Math.floor(grossGeo * TOPUP_COMMISSION);
  const netGeo   = grossGeo - commission;

  if (netGeo < 1) {
    return res.status(400).json({ error: 'INVALID_PARAMS', message: 'Amount too small to convert to GEO' });
  }

  // amount = netGeo (what business receives after commission is taken at topup)
  const insertPayload = { business_id: business.id, amount: netGeo };
  // note is optional — ignore error if column missing
  const { data: request, error: insertError } = await supabase
    .from('topup_requests')
    .insert({ ...insertPayload, note: `${uzsAmount} UZS → ${grossGeo} GEO gross, −${commission} GEO commission` })
    .select('id, amount, created_at')
    .single();

  if (insertError) {
    // Retry without note in case the column has constraints
    const { data: r2, error: e2 } = await supabase
      .from('topup_requests')
      .insert(insertPayload)
      .select('id, amount, created_at')
      .single();
    if (e2) {
      console.error('topup insert error', e2);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
    Object.assign(insertPayload, r2);
    return res.json({
      request: r2,
      breakdown: { uzsAmount, grossGeo, commission, netGeo, geoRate },
      paymentDetails: {
        cardNumber: process.env.TOPUP_CARD_NUMBER || '0000 0000 0000 0000',
        cardHolder: process.env.TOPUP_CARD_HOLDER || 'GeoEarn',
        bank: process.env.TOPUP_BANK || 'Payme',
        uzsAmount, netGeo,
        comment: `GeoEarn #${r2.id}`,
      },
    });
  }

  return res.json({
    request,
    breakdown: { uzsAmount, grossGeo, commission, netGeo, geoRate },
    paymentDetails: {
      cardNumber: process.env.TOPUP_CARD_NUMBER || '0000 0000 0000 0000',
      cardHolder: process.env.TOPUP_CARD_HOLDER || 'GeoEarn',
      bank: process.env.TOPUP_BANK || 'Payme',
      uzsAmount,
      netGeo,
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
