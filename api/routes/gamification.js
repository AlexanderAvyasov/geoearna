const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');
const { getUserGameData, getTashkentDay, getWeekStart, grantXp } = require('../services/gamification');

const router = express.Router();

// GET /api/me/game — full gamification state for current user
router.get('/api/me/game', validateTma, async (req, res) => {
  try {
    const data = await getUserGameData(req.user.id);
    res.json(data);
  } catch (e) {
    console.error('[GET /api/me/game]', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /api/me/tasks/:key/claim — claim completed task reward
router.post('/api/me/tasks/:key/claim', validateTma, async (req, res) => {
  const { key } = req.params;
  const userId  = req.user.id;

  const today     = getTashkentDay();
  const weekStart = getWeekStart(today);

  const { data: td } = await supabase
    .from('task_definitions').select('*').eq('key', key).maybeSingle();

  if (!td) return res.status(404).json({ error: 'TASK_NOT_FOUND' });

  const periodDate = td.type === 'daily' ? today : td.type === 'weekly' ? weekStart : '1970-01-01';

  const { data: ut } = await supabase
    .from('user_tasks').select('*')
    .eq('user_id', userId).eq('task_key', key).eq('period_date', periodDate).maybeSingle();

  if (!ut?.completed)  return res.status(400).json({ error: 'NOT_COMPLETED' });
  if (ut.claimed)      return res.status(400).json({ error: 'ALREADY_CLAIMED' });

  // Mark claimed
  await supabase.from('user_tasks')
    .update({ claimed: true })
    .eq('user_id', userId).eq('task_key', key).eq('period_date', periodDate);

  // Grant GEO from platform wallet
  if (td.geo_reward > 0) {
    await supabase.rpc('apply_checkin_bonus', { p_user_id: userId, p_amount: td.geo_reward });
  }

  // Grant XP
  let xpResult = null;
  if (td.xp_reward > 0) {
    xpResult = await grantXp(userId, td.xp_reward, `task_${key}`);
  }

  const { data: updatedUser } = await supabase
    .from('users').select('balance, xp, level').eq('id', userId).single();

  res.json({
    geoRewarded: td.geo_reward,
    xpRewarded:  td.xp_reward,
    newBalance:  updatedUser?.balance || 0,
    newXp:       updatedUser?.xp || 0,
    newLevel:    updatedUser?.level || 1,
    leveledUp:   xpResult?.leveled_up || false,
  });
});

// GET /api/me/referral — referral stats for current user
router.get('/api/me/referral', validateTma, async (req, res) => {
  const userId = req.user.id;

  const [{ data: user }, { data: referrals }, { data: earnings }] = await Promise.all([
    supabase.from('users').select('referral_code').eq('id', userId).single(),
    supabase.from('referrals').select('referred_id, activated, activated_at, passive_until')
      .eq('referrer_id', userId).order('activated', { ascending: false }),
    supabase.from('referral_earnings').select('amount, created_at')
      .eq('referrer_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);

  const botUsername = process.env.BOT_USERNAME || 'GeoEarnBot';
  const code = user?.referral_code || '';
  const totalEarned = (earnings || []).reduce((s, r) => s + r.amount, 0);

  res.json({
    code,
    link: `https://t.me/${botUsername}?start=${code}`,
    totalReferrals:    (referrals || []).length,
    activatedReferrals: (referrals || []).filter(r => r.activated).length,
    totalEarned,
    recentEarnings: earnings || [],
    referrals: referrals || [],
  });
});

module.exports = router;
