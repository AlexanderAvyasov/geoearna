const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');

const router = express.Router();

// GET /api/platform-promo/list  — list all active platform promos (no auth needed)
router.get('/api/platform-promo/list', async (req, res) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('platform_promotions')
    .select('id, title, description, reward_amount, channel_username, max_claims, claims_count, ends_at')
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('created_at', { ascending: false });

  if (error) { console.error('[platform-promo/list]', error); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
  return res.json({ promos: data || [] });
});

// GET /api/platform-promo/info?token=  — single promo info (no auth)
router.get('/api/platform-promo/info', async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string' || token.length > 128) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }

  const { data: promo, error } = await supabase
    .from('platform_promotions')
    .select('id, title, description, reward_amount, channel_username, max_claims, claims_count, active, ends_at')
    .eq('token', token)
    .maybeSingle();

  if (error) { console.error('[platform-promo/info]', error); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
  if (!promo) return res.status(404).json({ error: 'NOT_FOUND' });
  if (!promo.active) return res.status(410).json({ error: 'PROMO_INACTIVE' });
  if (promo.ends_at && new Date(promo.ends_at) <= new Date()) return res.status(410).json({ error: 'PROMO_EXPIRED' });
  if (promo.claims_count >= promo.max_claims) return res.status(410).json({ error: 'PROMO_EXHAUSTED' });

  return res.json({
    id:              promo.id,
    title:           promo.title,
    description:     promo.description || null,
    reward:          promo.reward_amount,
    channelUsername: promo.channel_username,
    remaining:       promo.max_claims - promo.claims_count,
    endsAt:          promo.ends_at || null,
  });
});

// POST /api/platform-promo/claim  — verify subscription + award GEO
router.post('/api/platform-promo/claim', validateTma, async (req, res) => {
  const { token } = req.body;
  const userId    = req.user.id;
  const tgId      = req.user.telegram_id;

  if (!token || typeof token !== 'string' || token.length > 128) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }

  // Ban check
  const { data: userRow } = await supabase.from('users').select('banned_at').eq('id', userId).single();
  if (userRow?.banned_at) return res.status(403).json({ error: 'USER_BANNED' });

  // Fetch promo
  const { data: promo, error: promoErr } = await supabase
    .from('platform_promotions')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (promoErr) { console.error('[platform-promo/claim] fetch', promoErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
  if (!promo)        return res.status(404).json({ error: 'NOT_FOUND' });
  if (!promo.active) return res.status(400).json({ error: 'PROMO_INACTIVE' });
  if (promo.ends_at && new Date(promo.ends_at) <= new Date()) return res.status(400).json({ error: 'PROMO_EXPIRED' });
  if (promo.claims_count >= promo.max_claims) return res.status(400).json({ error: 'PROMO_EXHAUSTED' });

  // Already claimed?
  const { data: existing } = await supabase
    .from('platform_promo_claims')
    .select('id')
    .eq('promo_id', promo.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return res.status(400).json({ error: 'ALREADY_CLAIMED' });

  // Verify Telegram channel subscription via Bot API
  try {
    const { bot } = require('../../bot/index');
    const member = await bot.api.getChatMember(promo.channel_id, Number(tgId));
    const subscribedStatuses = ['member', 'administrator', 'creator'];
    if (!subscribedStatuses.includes(member.status)) {
      return res.status(403).json({ error: 'NOT_SUBSCRIBED', channelUsername: promo.channel_username });
    }
  } catch (err) {
    console.error('[platform-promo/claim] getChatMember', err.message);
    // If the bot can't check (e.g. bot not in channel), fail closed
    return res.status(500).json({ error: 'SUBSCRIPTION_CHECK_FAILED' });
  }

  // Award GEO
  const { error: geoErr } = await supabase.rpc('apply_checkin_bonus', {
    p_user_id: userId,
    p_amount:  promo.reward_amount,
  });
  if (geoErr) { console.error('[platform-promo/claim] apply_checkin_bonus', geoErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }

  // Record claim
  const { error: claimErr } = await supabase.from('platform_promo_claims').insert({
    promo_id:   promo.id,
    user_id:    userId,
    claimed_at: new Date().toISOString(),
  });
  if (claimErr && claimErr.code === '23505') {
    return res.status(400).json({ error: 'ALREADY_CLAIMED' });
  }
  if (claimErr) { console.error('[platform-promo/claim] insert', claimErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }

  // Update claims_count
  const { count: actualCount } = await supabase
    .from('platform_promo_claims')
    .select('*', { count: 'exact', head: true })
    .eq('promo_id', promo.id);
  const newCount = actualCount || promo.claims_count + 1;
  await supabase.from('platform_promotions')
    .update({ claims_count: newCount, ...(newCount >= promo.max_claims ? { active: false } : {}) })
    .eq('id', promo.id);

  const { data: updated } = await supabase.from('users').select('balance').eq('id', userId).single();

  return res.json({
    reward:       promo.reward_amount,
    totalBalance: updated?.balance || 0,
    title:        promo.title,
  });
});

// ── SuperAdmin: list all platform promos ──────────────────────────────────────
router.get('/api/sa/platform-promos', validateTma, async (req, res) => {
  if (!req.user.is_super_admin) return res.status(403).json({ error: 'FORBIDDEN' });
  const { data, error } = await supabase
    .from('platform_promotions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  return res.json({ promos: data || [] });
});

// ── SuperAdmin: create platform promo ────────────────────────────────────────
router.post('/api/sa/platform-promos', validateTma, async (req, res) => {
  if (!req.user.is_super_admin) return res.status(403).json({ error: 'FORBIDDEN' });
  const { title, description, reward_amount, channel_username, channel_id, max_claims, ends_at } = req.body;
  if (!title || !reward_amount || !channel_username || !channel_id) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }
  const { data, error } = await supabase.from('platform_promotions').insert({
    title, description: description || null,
    reward_amount, channel_username, channel_id,
    max_claims: max_claims || 10000,
    ends_at: ends_at || null,
  }).select().single();
  if (error) { console.error('[sa/platform-promos] insert', error); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
  return res.json(data);
});

// ── SuperAdmin: toggle active ──────────────────────────────────────────────
router.patch('/api/sa/platform-promos/:id', validateTma, async (req, res) => {
  if (!req.user.is_super_admin) return res.status(403).json({ error: 'FORBIDDEN' });
  const { active } = req.body;
  const { data, error } = await supabase.from('platform_promotions')
    .update({ active })
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  return res.json(data);
});

module.exports = router;
