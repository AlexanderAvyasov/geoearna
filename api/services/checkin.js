const { supabase } = require('../../db/index');
const { getDistance } = require('./geo');
const {
  getTashkentDay,
  getWeekStart,
  getLevelInfo,
  getStreakAndLevel,
  getActiveBoosts,
  computeMultipliers,
  applyStreakUpdate,
  grantXp,
  checkAndUpdateTasks,
  checkAchievements,
} = require('./gamification');

async function performCheckin({ userId, qrToken, lat, lng, pin }) {
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('qr_token', qrToken)
    .maybeSingle();

  if (businessError) {
    console.error('checkin business lookup error', businessError);
    throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
  }
  if (!business) {
    throw Object.assign(new Error('INVALID_QR_TOKEN'), { code: 'INVALID_QR_TOKEN' });
  }

  const distance = getDistance({ lat, lng }, { lat: business.lat, lng: business.lng });
  if (distance > business.radius_m) {
    throw Object.assign(new Error('TOO_FAR'), { code: 'TOO_FAR' });
  }

  const { data: campaigns, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('business_id', business.id)
    .eq('active', true);

  if (campaignError) {
    console.error('checkin campaign lookup error', campaignError);
    throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
  }

  const now = new Date();
  const campaign = (campaigns || []).find(item => {
    const endsAt = item.ends_at ? new Date(item.ends_at) : null;
    return (!endsAt || endsAt > now) && item.visits_count < item.max_visits;
  });

  if (!campaign) {
    throw Object.assign(new Error('NO_ACTIVE_CAMPAIGN'), { code: 'NO_ACTIVE_CAMPAIGN' });
  }
  if (business.balance < campaign.reward_amount) {
    throw Object.assign(new Error('BUSINESS_INSUFFICIENT_FUNDS'), { code: 'BUSINESS_INSUFFICIENT_FUNDS' });
  }

  // PIN validation
  if (campaign.requires_pin) {
    if (!pin) throw Object.assign(new Error('PIN_REQUIRED'), { code: 'PIN_REQUIRED' });

    const { data: pinRecord, error: pinError } = await supabase
      .from('verification_pins')
      .select('id, used, expires_at')
      .eq('business_id', business.id)
      .eq('pin', String(pin))
      .maybeSingle();

    if (pinError) throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
    if (!pinRecord) throw Object.assign(new Error('INVALID_PIN'), { code: 'INVALID_PIN' });
    if (pinRecord.used) throw Object.assign(new Error('PIN_USED'), { code: 'PIN_USED' });
    if (new Date(pinRecord.expires_at) < now) throw Object.assign(new Error('PIN_EXPIRED'), { code: 'PIN_EXPIRED' });

    await supabase.from('verification_pins').update({ used: true }).eq('id', pinRecord.id);
  }

  // ── Gamification pre-computation ─────────────────────────────────────────
  const [{ streak, user }, boosts, { count: prevVisitCount }] = await Promise.all([
    getStreakAndLevel(userId),
    getActiveBoosts(business.id),
    supabase.from('visits').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('business_id', business.id),
  ]);

  const levelInfo = getLevelInfo(user?.xp || 0);
  const { streakMult, levelMult, boostMult, newPlaceBonus, isBeforeNoon, projectedStreak: projStreak } =
    computeMultipliers({ streak, levelInfo, boosts, businessCreatedAt: business.created_at });

  const baseReward = campaign.reward_amount;
  const effectiveReward = Math.round(baseReward * levelMult * streakMult * boostMult);
  const platformBonus = effectiveReward - baseReward + newPlaceBonus;

  // ── Atomic checkin (business pays base reward) ────────────────────────────
  const { data: visitId, error: rpcError } = await supabase.rpc('process_checkin', {
    p_user_id:     userId,
    p_business_id: business.id,
    p_campaign_id: campaign.id,
    p_lat:         lat,
    p_lng:         lng,
    p_reward:      baseReward,
  });

  if (rpcError) {
    const code = rpcError.message?.includes('BUSINESS_INSUFFICIENT_FUNDS') ? 'BUSINESS_INSUFFICIENT_FUNDS'
      : rpcError.message?.includes('NO_ACTIVE_CAMPAIGN') ? 'NO_ACTIVE_CAMPAIGN'
      : 'INTERNAL_ERROR';
    console.error('checkin rpc error', rpcError);
    throw Object.assign(new Error(code), { code });
  }

  // Platform covers multiplier bonus + new-place bonus
  if (platformBonus > 0) {
    await supabase.rpc('apply_checkin_bonus', { p_user_id: userId, p_amount: platformBonus });
  }

  // Fetch updated balance
  const { data: updatedUser } = await supabase
    .from('users').select('balance').eq('id', userId).single();

  // ── Gamification pipeline (fire-and-forget) ───────────────────────────────
  const today     = getTashkentDay();
  const weekStart = getWeekStart(today);
  const isFirstVisitToThisBusiness = (prevVisitCount || 0) === 0;

  ;(async () => {
    try {
      const streakResult = await applyStreakUpdate(userId, today);
      const newStreak = streakResult.newStreak;

      const xpAmount =
        10 +
        (isFirstVisitToThisBusiness ? 20 : 0) +
        (!streakResult.alreadyDone ? 5 : 0);
      await grantXp(userId, xpAmount, 'checkin');

      await Promise.all([
        supabase.rpc('activate_referral', { p_referred_id: userId }),
        visitId
          ? supabase.rpc('process_referral_income', { p_referred_id: userId, p_visit_id: visitId, p_reward: baseReward })
          : Promise.resolve(),
        checkAndUpdateTasks(userId, business.id, today, weekStart, newStreak, isBeforeNoon),
        checkAchievements(userId, business.id, newStreak),
      ]);
    } catch (e) {
      console.error('[gamification] pipeline error', e?.message);
    }
  })();

  return {
    reward:       effectiveReward + newPlaceBonus,
    baseReward,
    bonusReward:  platformBonus,
    totalBalance: updatedUser?.balance || 0,
    businessName: business.name,
    streakInfo: {
      projected: projStreak,
      streakMult,
    },
    levelInfo: {
      level: levelInfo.level,
      label: levelInfo.label,
      levelMult,
    },
    newPlaceBonus,
  };
}

module.exports = { performCheckin };
