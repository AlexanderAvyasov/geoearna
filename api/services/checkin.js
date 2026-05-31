const { supabase } = require('../../db/index');
const { getDistance } = require('./geo');
const { sendMessage } = require('./notify');
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

const REFERRAL_BONUS_REFERRER = 25;
const REFERRAL_BONUS_NEW_USER = 10;

async function activateReferral(userId, telegramId) {
  try {
    const { data: referral } = await supabase
      .from('referrals')
      .select('id, referrer_id')
      .eq('referred_id', userId)
      .eq('activated', false)
      .maybeSingle();

    if (!referral) return;

    await Promise.all([
      supabase.from('referrals')
        .update({ activated: true, activated_at: new Date().toISOString() })
        .eq('id', referral.id),
      supabase.rpc('apply_checkin_bonus', { p_user_id: userId,             p_amount: REFERRAL_BONUS_NEW_USER }),
      supabase.rpc('apply_checkin_bonus', { p_user_id: referral.referrer_id, p_amount: REFERRAL_BONUS_REFERRER }),
      supabase.from('referral_earnings').insert({
        referrer_id: referral.referrer_id,
        referred_id: userId,
        amount: REFERRAL_BONUS_REFERRER,
      }),
    ]);

    const { data: referrerRow } = await supabase
      .from('users').select('telegram_id').eq('id', referral.referrer_id).single();

    if (referrerRow?.telegram_id) {
      sendMessage(referrerRow.telegram_id,
        `👥 *Реферал активирован!*\n\n` +
        `Ваш друг сделал первый чекин.\n` +
        `💰 *+${REFERRAL_BONUS_REFERRER} GEO* зачислено на ваш счёт!`
      ).catch(() => {});
    }

    if (telegramId) {
      sendMessage(telegramId,
        `🎁 *Приветственный бонус!*\n\n` +
        `*+${REFERRAL_BONUS_NEW_USER} GEO* начислено за приход по реферальной ссылке!`
      ).catch(() => {});
    }
  } catch (e) {
    console.error('[referral] activateReferral error', e?.message);
  }
}

async function performCheckin({ userId, qrToken, lat, lng, pin, campaignId }) {
  const now = new Date();
  let business, campaign;

  // ── Try campaign-level QR token first ─────────────────────────────────────
  const { data: campaignByToken, error: campLookupErr } = await supabase
    .from('campaigns')
    .select('*')
    .eq('qr_token', qrToken)
    .maybeSingle();

  if (campLookupErr) {
    console.error('checkin campaign token lookup error', campLookupErr);
    throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
  }

  if (campaignByToken) {
    const { data: bizByToken, error: bizTokenErr } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', campaignByToken.business_id)
      .maybeSingle();
    if (bizTokenErr || !bizByToken) {
      console.error('checkin business lookup by campaign error', bizTokenErr);
      throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
    }
    business = bizByToken;
    const endsAt = campaignByToken.ends_at ? new Date(campaignByToken.ends_at) : null;
    const valid  = campaignByToken.active && (!endsAt || endsAt > now) && campaignByToken.visits_count < campaignByToken.max_visits;
    campaign = valid ? campaignByToken : null;
    if (!campaign) {
      throw Object.assign(new Error('NO_ACTIVE_CAMPAIGN'), { code: 'NO_ACTIVE_CAMPAIGN' });
    }
  } else {
    // ── Fallback: business-level QR token ─────────────────────────────────────
    const { data: businessRow, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('qr_token', qrToken)
      .maybeSingle();

    if (businessError) {
      console.error('checkin business lookup error', businessError);
      throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
    }
    if (!businessRow) {
      throw Object.assign(new Error('INVALID_QR_TOKEN'), { code: 'INVALID_QR_TOKEN' });
    }
    business = businessRow;

    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('business_id', business.id)
      .eq('active', true);

    if (campaignError) {
      console.error('checkin campaign lookup error', campaignError);
      throw Object.assign(new Error('INTERNAL_ERROR'), { code: 'INTERNAL_ERROR' });
    }

    if (campaignId) {
      const found = (campaigns || []).find(item => item.id === campaignId);
      if (found) {
        const endsAt = found.ends_at ? new Date(found.ends_at) : null;
        campaign = (found.active && (!endsAt || endsAt > now) && found.visits_count < found.max_visits) ? found : null;
      }
    } else {
      campaign = (campaigns || []).find(item => {
        const endsAt = item.ends_at ? new Date(item.ends_at) : null;
        return (!endsAt || endsAt > now) && item.visits_count < item.max_visits;
      });
    }

    if (!campaign) {
      throw Object.assign(new Error('NO_ACTIVE_CAMPAIGN'), { code: 'NO_ACTIVE_CAMPAIGN' });
    }
  }

  const distance = getDistance({ lat, lng }, { lat: business.lat, lng: business.lng });
  if (distance > business.radius_m) {
    throw Object.assign(new Error('TOO_FAR'), { code: 'TOO_FAR' });
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
  const [{ streak, user }, boosts, { count: prevVisitCount }, { count: totalVisitCount }] = await Promise.all([
    getStreakAndLevel(userId),
    getActiveBoosts(business.id),
    supabase.from('visits').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('business_id', business.id),
    supabase.from('visits').select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
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

  // Referral passive income: +5% of base reward to referrer for 30 days after activation
  if (visitId) {
    (async () => {
      const { error } = await supabase.rpc('process_referral_income', {
        p_referred_id: userId,
        p_visit_id:    visitId,
        p_reward:      baseReward,
      });
      if (error) console.error('[referral] process_referral_income error', error?.message);
    })();
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
  const isFirstCheckinEver         = (totalVisitCount || 0) === 0;
  const prevLevel = levelInfo.level;
  const prevXp    = user?.xp || 0;

  ;(async () => {
    try {
      const { data: userRow } = await supabase
        .from('users').select('telegram_id').eq('id', userId).single();
      const telegramId = userRow?.telegram_id;

      const streakResult = await applyStreakUpdate(userId, today);
      const newStreak = streakResult.newStreak;

      const xpAmount =
        10 +
        (isFirstVisitToThisBusiness ? 20 : 0) +
        (!streakResult.alreadyDone ? 5 : 0);
      await grantXp(userId, xpAmount, 'checkin');

      const newLevelInfo = getLevelInfo(prevXp + xpAmount);

      const [newlyUnlocked] = await Promise.all([
        checkAchievements(userId, business.id, newStreak),
        isFirstCheckinEver ? activateReferral(userId, telegramId) : Promise.resolve(),
        checkAndUpdateTasks(userId, business.id, today, weekStart, newStreak, isBeforeNoon),
      ]);

      if (telegramId) {
        // Level-up notification
        if (newLevelInfo.level > prevLevel) {
          const bonusPct = Math.round((newLevelInfo.bonus - 1) * 100);
          sendMessage(telegramId,
            `🎖 *Новый уровень!*\n\n` +
            `Уровень ${newLevelInfo.level} — *${newLevelInfo.label}*\n` +
            (bonusPct > 0 ? `Бонус к наградам: *+${bonusPct}%* 🚀` : '')
          ).catch(() => {});
          await new Promise(r => setTimeout(r, 150));
        }

        // Streak milestone bonus notification
        if (streakResult.milestoneBonus > 0) {
          sendMessage(telegramId,
            `🔥 *Стрик ${newStreak} дней — бонус зачислен!*\n\n` +
            `💰 +${streakResult.milestoneBonus.toLocaleString('ru-RU')} GEO\n` +
            `Не прерывайте серию! 💪`
          ).catch(() => {});
          await new Promise(r => setTimeout(r, 150));
        }

        // Achievement notifications
        for (const ach of (newlyUnlocked || [])) {
          sendMessage(telegramId,
            `🏆 *Достижение разблокировано!*\n\n` +
            `*${ach.title}*\n\n` +
            (ach.geo_reward > 0 ? `💰 +${ach.geo_reward.toLocaleString('ru-RU')} GEO\n` : '') +
            (ach.xp_reward > 0 ? `⚡ +${ach.xp_reward} XP` : '')
          ).catch(() => {});
          await new Promise(r => setTimeout(r, 150));
        }
      }
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
