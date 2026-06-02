const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');
const { getDistance } = require('../services/geo');

const router = express.Router();

const DAILY_CLAIM_LIMIT = 3;

// Public: list all active promo campaigns (shown on home screen)
router.get('/api/promos/active', async (_req, res) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('promo_campaigns')
    .select('id, title, description, reward_amount, rarity, max_claims, claims_count, expires_at, lat, lng')
    .eq('active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false });

  if (error) { console.error('[promos/active]', error); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
  return res.json({ promos: data || [] });
});

// Public: get promo campaign info (no auth)
router.get('/api/promo/info', async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string' || token.length > 128) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }

  const { data: promo, error } = await supabase
    .from('promo_campaigns')
    .select('id, title, description, reward_amount, max_claims, claims_count, rarity, expires_at, image_url, radius_m, active')
    .eq('token', token)
    .maybeSingle();

  if (error) { console.error('[promo/info]', error); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
  if (!promo) return res.status(404).json({ error: 'NOT_FOUND' });
  if (!promo.active) return res.status(410).json({ error: 'PROMO_INACTIVE' });

  const now = new Date();
  if (promo.expires_at && new Date(promo.expires_at) <= now) return res.status(410).json({ error: 'PROMO_EXPIRED' });
  if (promo.claims_count >= promo.max_claims) return res.status(410).json({ error: 'PROMO_EXHAUSTED' });

  return res.json({
    id:          promo.id,
    title:       promo.title,
    description: promo.description || null,
    reward:      promo.reward_amount,
    rarity:      promo.rarity,
    remaining:   promo.max_claims - promo.claims_count,
    expiresAt:   promo.expires_at || null,
    imageUrl:    promo.image_url || null,
    radiusM:     promo.radius_m,
  });
});

// Authenticated: claim promo reward
router.post('/api/promo/claim', validateTma, async (req, res) => {
  const { token, lat, lng } = req.body;
  const userId = req.user.id;
  const now = new Date();

  if (!token || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }

  // Ban check
  const { data: userRow } = await supabase.from('users').select('banned_at').eq('id', userId).single();
  if (userRow?.banned_at) return res.status(403).json({ error: 'USER_BANNED' });

  // Fetch promo
  const { data: promo, error: promoErr } = await supabase
    .from('promo_campaigns')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (promoErr) { console.error('[promo/claim] fetch', promoErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
  if (!promo)         return res.status(404).json({ error: 'NOT_FOUND' });
  if (!promo.active)  return res.status(400).json({ error: 'PROMO_INACTIVE' });
  if (promo.expires_at && new Date(promo.expires_at) <= now) return res.status(400).json({ error: 'PROMO_EXPIRED' });
  if (promo.claims_count >= promo.max_claims) return res.status(400).json({ error: 'PROMO_EXHAUSTED' });

  // Geo validation
  const dist = getDistance({ lat, lng }, { lat: promo.lat, lng: promo.lng });
  if (dist > promo.radius_m) {
    return res.status(400).json({ error: 'TOO_FAR', distance: Math.round(dist), required: promo.radius_m });
  }

  // Per-campaign claim / cooldown check
  const { data: lastClaim } = await supabase
    .from('promo_claims')
    .select('id, claimed_at')
    .eq('promo_id', promo.id)
    .eq('user_id', userId)
    .order('claimed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastClaim) {
    if (promo.cooldown_hours > 0) {
      const cooldownEnd = new Date(lastClaim.claimed_at).getTime() + promo.cooldown_hours * 3600_000;
      if (Date.now() < cooldownEnd) {
        return res.status(429).json({ error: 'COOLDOWN', availableAt: new Date(cooldownEnd).toISOString() });
      }
    } else {
      return res.status(400).json({ error: 'ALREADY_CLAIMED' });
    }
  }

  // Daily claim limit across all promos
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const { count: todayClaims } = await supabase
    .from('promo_claims')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('claimed_at', dayStart);

  if ((todayClaims || 0) >= DAILY_CLAIM_LIMIT) {
    return res.status(429).json({ error: 'DAILY_LIMIT_REACHED' });
  }

  // Record claim FIRST — prevents double-award if GEO step fails
  const { error: claimErr } = await supabase.from('promo_claims').insert({
    promo_id:    promo.id,
    user_id:     userId,
    claimed_at:  now.toISOString(),
    geo_awarded: promo.reward_amount,
    lat,
    lng,
  });
  // Duplicate key = concurrent claim snuck through — treat as already claimed
  if (claimErr?.code === '23505') return res.status(400).json({ error: 'ALREADY_CLAIMED' });
  if (claimErr) { console.error('[promo/claim] insert', claimErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }

  // Award GEO after claim is safely committed
  const { error: geoErr } = await supabase.rpc('apply_checkin_bonus', {
    p_user_id: userId,
    p_amount:  promo.reward_amount,
  });
  if (geoErr) { console.error('[promo/claim] apply_checkin_bonus', geoErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }

  // Sync claims_count from real count (handles concurrent claims better than +1)
  const { count: actualCount } = await supabase
    .from('promo_claims')
    .select('*', { count: 'exact', head: true })
    .eq('promo_id', promo.id);

  const newCount = actualCount || promo.claims_count + 1;
  await supabase.from('promo_campaigns')
    .update({
      claims_count: newCount,
      ...(newCount >= promo.max_claims ? { active: false } : {}),
    })
    .eq('id', promo.id);

  if ((todayClaims || 0) >= 2) {
    supabase.from('sa_audit_log').insert({
      action: 'promo_multi_claim', target_id: userId,
      note: `${(todayClaims || 0) + 1} promo claims today; promo_id=${promo.id} "${promo.title}"`,
    }).catch(() => {});
  }

  const { data: updated } = await supabase.from('users').select('balance').eq('id', userId).single();

  return res.json({
    reward:       promo.reward_amount,
    totalBalance: updated?.balance || 0,
    rarity:       promo.rarity,
    title:        promo.title,
  });
});

module.exports = router;
