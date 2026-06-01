const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');

const router = express.Router();

const SA_TG_ID = Number(process.env.SUPER_ADMIN_TG_ID) || 0;

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

    const is_super_admin = SA_TG_ID > 0 && Number(user.telegram_id) === SA_TG_ID;
    return res.json({ user, is_super_admin });
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

// Unified activity feed: visits + promo + geohunt + referrals + task rewards
router.get('/api/activity', validateTma, async (req, res) => {
  try {
    const userId = req.user.id;

    const [visitsRes, promoRes, geohuntCodesRes, referralEarningsRes, tasksRes] = await Promise.all([
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
      supabase.from('referral_earnings')
        .select('id, amount, created_at, referred_id')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('user_tasks')
        .select('task_key, period_date, task_definitions(title, geo_reward)')
        .eq('user_id', userId)
        .eq('claimed', true)
        .order('period_date', { ascending: false })
        .limit(20),
    ]);

    // Two-step joins
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
      items.push({ id: `v_${v.id}`, type: 'visit', title: v.businesses?.name || 'Заведение', amount: v.rewarded, created_at: v.created_at });
    }
    for (const p of promoRes.data || []) {
      const promo = promosMap[p.promo_id];
      items.push({ id: `p_${p.id}`, type: 'promo', title: promo?.title || 'Promo QR', rarity: promo?.rarity || 'common', amount: p.geo_awarded, created_at: p.claimed_at });
    }
    for (const g of geohuntCodesRes.data || []) {
      const hunt = huntsMap[g.hunt_id];
      items.push({ id: `g_${g.id}`, type: 'geohunt', title: hunt?.title || 'GeoHunt', amount: hunt?.reward_per_code || 0, created_at: g.used_at });
    }
    for (const r of referralEarningsRes.data || []) {
      items.push({ id: `r_${r.id}`, type: 'referral', title: 'Реферальный бонус', amount: r.amount, created_at: r.created_at });
    }
    for (const t of tasksRes.data || []) {
      const geo = t.task_definitions?.geo_reward || 0;
      if (geo <= 0) continue;
      items.push({ id: `t_${t.task_key}_${t.period_date}`, type: 'task', title: t.task_definitions?.title || t.task_key, amount: geo, created_at: t.period_date });
    }

    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ activity: items.slice(0, 40) });
  } catch (err) {
    console.error('GET /api/activity', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
