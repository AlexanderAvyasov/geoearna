const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');

const router = express.Router();

router.get('/api/me', validateTma, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, telegram_id, username, balance, created_at')
      .eq('id', req.user.id)
      .single();

    if (error) {
      console.error('GET /api/me error', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('GET /api/me error', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/api/visits', validateTma, async (req, res) => {
  try {
    const { data: visits, error } = await supabase
      .from('visits')
      .select(`
        id,
        campaign_id,
        lat,
        lng,
        rewarded,
        created_at,
        businesses (
          name
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('GET /api/visits error', error);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    const mapped = (visits || []).map((v) => ({
      id: v.id,
      campaign_id: v.campaign_id,
      lat: v.lat,
      lng: v.lng,
      rewarded: v.rewarded,
      created_at: v.created_at,
      business_name: v.businesses?.name || '',
    }));

    return res.json({ visits: mapped });
  } catch (error) {
    console.error('GET /api/visits error', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Unified activity feed: visits + promo QR claims + geohunt claims
router.get('/api/activity', validateTma, async (req, res) => {
  try {
    const userId = req.user.id;

    const [visitsRes, promoRes, geohuntCodesRes] = await Promise.all([
      supabase.from('visits')
        .select('id, rewarded, created_at, businesses(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('promo_claims')
        .select('id, geo_awarded, claimed_at, promo_id')
        .eq('user_id', userId)
        .order('claimed_at', { ascending: false })
        .limit(30),
      supabase.from('geohunt_codes')
        .select('id, used_at, hunt_id')
        .eq('used_by', userId)
        .not('used_at', 'is', null)
        .order('used_at', { ascending: false })
        .limit(30),
    ]);

    // Two-step joins to avoid PostgREST FK traversal issues on UUID tables
    const promoIds = [...new Set((promoRes.data || []).map(c => c.promo_id).filter(Boolean))];
    const promosMap = {};
    if (promoIds.length > 0) {
      const { data: promos } = await supabase.from('promo_campaigns')
        .select('id, title, rarity').in('id', promoIds);
      (promos || []).forEach(p => { promosMap[p.id] = p; });
    }

    const huntIds = [...new Set((geohuntCodesRes.data || []).map(c => c.hunt_id).filter(Boolean))];
    const huntsMap = {};
    if (huntIds.length > 0) {
      const { data: hunts } = await supabase.from('geohunts')
        .select('id, title, reward_per_code').in('id', huntIds);
      (hunts || []).forEach(h => { huntsMap[h.id] = h; });
    }

    const items = [];

    for (const v of visitsRes.data || []) {
      items.push({
        id:         `v_${v.id}`,
        type:       'visit',
        title:      v.businesses?.name || 'Бизнес',
        amount:     v.rewarded,
        created_at: v.created_at,
      });
    }

    for (const p of promoRes.data || []) {
      const promo = promosMap[p.promo_id];
      items.push({
        id:         `p_${p.id}`,
        type:       'promo',
        title:      promo?.title || 'Promo QR',
        rarity:     promo?.rarity || 'common',
        amount:     p.geo_awarded,
        created_at: p.claimed_at,
      });
    }

    for (const g of geohuntCodesRes.data || []) {
      const hunt = huntsMap[g.hunt_id];
      items.push({
        id:         `g_${g.id}`,
        type:       'geohunt',
        title:      hunt?.title || 'GeoHunt',
        amount:     hunt?.reward_per_code || 0,
        created_at: g.used_at,
      });
    }

    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ activity: items.slice(0, 30) });
  } catch (err) {
    console.error('GET /api/activity', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
