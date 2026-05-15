const { supabase } = require('../../db/index');

const TASHKENT_MS = 5 * 60 * 60 * 1000; // UTC+5
const GRACE_MS    = 2 * 60 * 60 * 1000; // 2-hour grace period

const LEVELS = [
  { min: 5000, level: 10, label: 'Легенда',       bonus: 1.25 },
  { min: 4500, level: 9,  label: 'Чемпион',       bonus: 1.20 },
  { min: 3750, level: 8,  label: 'Элита',          bonus: 1.18 },
  { min: 3000, level: 7,  label: 'Ветеран',        bonus: 1.15 },
  { min: 2000, level: 6,  label: 'Мастер',         bonus: 1.12 },
  { min: 1000, level: 5,  label: 'Эксперт',        bonus: 1.10 },
  { min: 500,  level: 4,  label: 'Активный',       bonus: 1.08 },
  { min: 250,  level: 3,  label: 'Постоянный',     bonus: 1.05 },
  { min: 100,  level: 2,  label: 'Исследователь',  bonus: 1.02 },
  { min: 0,    level: 1,  label: 'Новичок',        bonus: 1.00 },
];

const MILESTONE_GEO = { 7: 500, 14: 1500, 30: 5000 };

// Returns the Tashkent "game day" as YYYY-MM-DD.
// Visits before 02:00 Tashkent (= UTC+5) still count for the previous calendar day.
function getTashkentDay() {
  const gameDayMs = Date.now() + TASHKENT_MS - GRACE_MS;
  return new Date(gameDayMs).toISOString().slice(0, 10);
}

function dateOffset(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Monday of the Tashkent game week
function getWeekStart(today) {
  const d = new Date(today + 'T12:00:00Z');
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

// UTC timestamp range that corresponds to a Tashkent game day.
// game_day = (UTC + 5h - 2h).date  =>  UTC start = gameDay-1 21:00, end = gameDay 21:00
function gameDayToUTCRange(dayStr) {
  const end   = new Date(dayStr + 'T21:00:00Z');
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getLevelInfo(xp) {
  return LEVELS.find(l => (xp || 0) >= l.min);
}

function getNextLevelXp(xp) {
  const thresholds = [100, 250, 500, 1000, 2000, 3000, 3750, 4500, 5000];
  return thresholds.find(t => (xp || 0) < t) || null;
}

async function getStreakAndLevel(userId) {
  const [{ data: streak }, { data: user }] = await Promise.all([
    supabase.from('user_streaks').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('users').select('xp, level, balance').eq('id', userId).single(),
  ]);
  return {
    streak: streak || { user_id: userId, current_streak: 0, longest_streak: 0, last_checkin_date: null, freeze_available: 0, freeze_used_date: null },
    user: user || { xp: 0, level: 1, balance: 0 },
  };
}

async function getActiveBoosts(businessId) {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('boosts')
    .select('*')
    .eq('active', true)
    .lte('starts_at', now)
    .gte('ends_at', now);

  return (data || []).filter(b =>
    !b.filter?.business_ids || b.filter.business_ids.includes(businessId)
  );
}

// What the streak will be AFTER this checkin (used for multiplier pre-computation)
function projectedStreak(streak, today) {
  const yesterday = dateOffset(today, -1);
  if (!streak.last_checkin_date) return 1;
  if (streak.last_checkin_date === today) return streak.current_streak;
  if (streak.last_checkin_date === yesterday) return streak.current_streak + 1;
  return streak.freeze_available > 0 ? streak.current_streak : 1;
}

function computeMultipliers({ streak, levelInfo, boosts, businessCreatedAt }) {
  const today = getTashkentDay();
  const projected = projectedStreak(streak, today);

  const streakMult = [7, 14, 30].includes(projected) ? 1.5 : 1.0;
  const levelMult  = levelInfo.bonus;

  // Highest active DB boost multiplier
  let boostMult = 1.0;
  for (const b of boosts) {
    if (parseFloat(b.multiplier) > boostMult) boostMult = parseFloat(b.multiplier);
  }

  // Happy Hour: ×2 on Fridays 12:00–14:00 Tashkent
  const tNow = new Date(Date.now() + TASHKENT_MS);
  if (tNow.getUTCDay() === 5) {
    const h = tNow.getUTCHours();
    if (h >= 12 && h < 14) boostMult = Math.max(boostMult, 2.0);
  }

  // New place bonus: flat +100 GEO if business opened < 7 days ago
  const newPlaceBonus = businessCreatedAt &&
    Date.now() - new Date(businessCreatedAt).getTime() < 7 * 24 * 3600 * 1000 ? 100 : 0;

  // Is before noon in Tashkent? (for daily_before_noon task)
  const isBeforeNoon = tNow.getUTCHours() < 12;

  return { streakMult, levelMult, boostMult, newPlaceBonus, projectedStreak: projected, isBeforeNoon };
}

async function applyStreakUpdate(userId, today) {
  const { data: existing } = await supabase
    .from('user_streaks').select('*').eq('user_id', userId).maybeSingle();

  const streak = existing || {
    user_id: userId, current_streak: 0, longest_streak: 0,
    last_checkin_date: null, freeze_available: 0, freeze_used_date: null,
  };

  const yesterday = dateOffset(today, -1);
  let newStreak;
  let frozeUsed = false;

  if (!streak.last_checkin_date) {
    newStreak = 1;
  } else if (streak.last_checkin_date === today) {
    return { newStreak: streak.current_streak, milestoneBonus: 0, frozeUsed: false, alreadyDone: true };
  } else if (streak.last_checkin_date === yesterday) {
    newStreak = streak.current_streak + 1;
  } else {
    if (streak.freeze_available > 0) {
      frozeUsed = true;
      newStreak = streak.current_streak;
    } else {
      newStreak = 1;
    }
  }

  const longestStreak = Math.max(streak.longest_streak, newStreak);
  let newFreezeAvail = frozeUsed ? streak.freeze_available - 1 : streak.freeze_available;
  if (!frozeUsed) {
    if (newStreak >= 14 && newFreezeAvail < 2) newFreezeAvail = 2;
    else if (newStreak >= 7 && newFreezeAvail < 1) newFreezeAvail = 1;
  }

  const row = {
    user_id: userId,
    current_streak: newStreak,
    longest_streak: longestStreak,
    last_checkin_date: today,
    freeze_available: newFreezeAvail,
    freeze_used_date: frozeUsed ? yesterday : streak.freeze_used_date,
  };

  if (existing) {
    await supabase.from('user_streaks').update(row).eq('user_id', userId);
  } else {
    await supabase.from('user_streaks').insert(row);
  }

  // Milestone GEO bonuses paid from platform wallet
  let milestoneBonus = 0;
  if (!frozeUsed && MILESTONE_GEO[newStreak]) {
    milestoneBonus = MILESTONE_GEO[newStreak];
    await supabase.rpc('apply_checkin_bonus', { p_user_id: userId, p_amount: milestoneBonus });
  }

  return { newStreak, milestoneBonus, frozeUsed, alreadyDone: false };
}

async function grantXp(userId, amount, reason) {
  const { data, error } = await supabase.rpc('grant_xp', {
    p_user_id: userId, p_amount: amount, p_reason: reason,
  });
  if (error) { console.error('[grantXp]', error); return null; }
  return Array.isArray(data) ? data[0] : data;
}

// ── Task progress ─────────────────────────────────────────────────────────────

async function checkAndUpdateTasks(userId, businessId, today, weekStart, newStreak, isBeforeNoon) {
  const { data: taskDefs } = await supabase.from('task_definitions').select('*');
  if (!taskDefs) return;

  const { start: dayStart, end: dayEnd } = gameDayToUTCRange(today);
  const { start: weekStartUTC } = gameDayToUTCRange(weekStart);

  for (const td of taskDefs) {
    try {
      const periodDate = td.type === 'daily' ? today : td.type === 'weekly' ? weekStart : '1970-01-01';
      const { data: existing } = await supabase
        .from('user_tasks').select('progress, completed, claimed')
        .eq('user_id', userId).eq('task_key', td.key).eq('period_date', periodDate).maybeSingle();

      if (existing?.completed) continue;

      let progress = existing?.progress || 0;
      let completed = false;

      switch (td.key) {
        case 'daily_1_checkin':
        case 'daily_3_checkins': {
          const { data: v } = await supabase.from('visits').select('id')
            .eq('user_id', userId).gte('created_at', dayStart).lt('created_at', dayEnd);
          progress = (v || []).length;
          completed = progress >= (td.requirement.checkin_count || 1);
          break;
        }
        case 'daily_2_places': {
          const { data: v } = await supabase.from('visits').select('business_id')
            .eq('user_id', userId).gte('created_at', dayStart).lt('created_at', dayEnd);
          progress = new Set((v || []).map(x => x.business_id)).size;
          completed = progress >= td.requirement.distinct_businesses;
          break;
        }
        case 'daily_before_noon':
          if (isBeforeNoon) { progress = 1; completed = true; }
          break;
        case 'daily_new_place': {
          // true if today's visits include a business_id never visited before today
          const { data: todayV } = await supabase.from('visits').select('business_id')
            .eq('user_id', userId).gte('created_at', dayStart).lt('created_at', dayEnd);
          const todayIds = [...new Set((todayV || []).map(x => x.business_id))];
          if (todayIds.length > 0) {
            const { data: prevV } = await supabase.from('visits').select('business_id')
              .eq('user_id', userId).lt('created_at', dayStart);
            const prevIds = new Set((prevV || []).map(x => x.business_id));
            progress = todayIds.some(id => !prevIds.has(id)) ? 1 : 0;
            completed = progress >= 1;
          }
          break;
        }
        case 'weekly_5_places': {
          const { data: v } = await supabase.from('visits').select('business_id')
            .eq('user_id', userId).gte('created_at', weekStartUTC);
          progress = new Set((v || []).map(x => x.business_id)).size;
          completed = progress >= td.requirement.distinct_businesses;
          break;
        }
        case 'weekly_streak_7':
          progress = newStreak;
          completed = newStreak >= td.requirement.streak_days;
          break;
        case 'weekly_15_checkins': {
          const { data: v } = await supabase.from('visits').select('id')
            .eq('user_id', userId).gte('created_at', weekStartUTC);
          progress = (v || []).length;
          completed = progress >= (td.requirement.checkin_count || 15);
          break;
        }
        case 'weekly_3_categories': {
          const { data: v } = await supabase
            .from('visits').select('campaign_id, campaigns!campaign_id(task_type)')
            .eq('user_id', userId).gte('created_at', weekStartUTC);
          const cats = new Set((v || []).map(x => x.campaigns?.task_type).filter(Boolean));
          progress = cats.size;
          completed = progress >= (td.requirement.distinct_categories || 3);
          break;
        }
        case 'onetime_first': {
          const { count } = await supabase.from('visits').select('id', { count: 'exact', head: true }).eq('user_id', userId);
          progress = count || 0;
          completed = progress >= td.requirement.checkin_count;
          break;
        }
        case 'onetime_withdrawal': {
          const { count } = await supabase.from('withdrawals').select('id', { count: 'exact', head: true })
            .eq('user_id', userId).in('status', ['approved', 'pending']);
          progress = count || 0;
          completed = progress >= (td.requirement.withdrawal_count || 1);
          break;
        }
        case 'onetime_referral': {
          const { count } = await supabase.from('referrals').select('referred_id', { count: 'exact', head: true })
            .eq('referrer_id', userId).eq('activated', true);
          progress = count || 0;
          completed = progress >= td.requirement.referral_activated;
          break;
        }
      }

      await supabase.from('user_tasks').upsert(
        { user_id: userId, task_key: td.key, period_date: periodDate, progress, completed, claimed: existing?.claimed || false },
        { onConflict: 'user_id,task_key,period_date' }
      );
    } catch (e) {
      console.error('[tasks] error on', td.key, e?.message);
    }
  }
}

// ── Achievement checks ────────────────────────────────────────────────────────

async function checkAchievements(userId, businessId, newStreak) {
  const [{ data: defs }, { data: earned }] = await Promise.all([
    supabase.from('achievement_definitions').select('*'),
    supabase.from('user_achievements').select('achievement_key').eq('user_id', userId),
  ]);
  if (!defs) return [];

  const earnedKeys = new Set((earned || []).map(a => a.achievement_key));
  const newlyUnlocked = [];

  for (const ad of defs) {
    if (earnedKeys.has(ad.key)) continue;
    let unlocked = false;

    try {
      switch (ad.key) {
        case 'pioneer': {
          const { data: v } = await supabase.from('visits').select('business_id').eq('user_id', userId);
          unlocked = new Set((v || []).map(x => x.business_id)).size >= ad.requirement.distinct_businesses;
          break;
        }
        case 'unbreakable':
          unlocked = newStreak >= ad.requirement.streak_days;
          break;
        case 'recruiter': {
          const { count } = await supabase.from('referrals').select('referred_id', { count: 'exact', head: true })
            .eq('referrer_id', userId).eq('activated', true);
          unlocked = (count || 0) >= ad.requirement.referrals_activated;
          break;
        }
        case 'early_bird': {
          // count visits before 04:00 UTC (= 09:00 Tashkent)
          const { data: v } = await supabase.from('visits').select('created_at').eq('user_id', userId);
          const earlyCount = (v || []).filter(x => new Date(x.created_at).getUTCHours() < 4).length;
          unlocked = earlyCount >= ad.requirement.early_checkins;
          break;
        }
        case 'loyal': {
          const { count } = await supabase.from('visits').select('id', { count: 'exact', head: true })
            .eq('user_id', userId).eq('business_id', businessId);
          unlocked = (count || 0) >= ad.requirement.same_business_visits;
          break;
        }
        // legend_quarter requires periodic batch job — skip here
      }

      if (unlocked) {
        await supabase.from('user_achievements').insert({ user_id: userId, achievement_key: ad.key });
        if (ad.geo_reward > 0) {
          await supabase.rpc('apply_checkin_bonus', { p_user_id: userId, p_amount: ad.geo_reward });
        }
        if (ad.xp_reward > 0) {
          await grantXp(userId, ad.xp_reward, `achievement_${ad.key}`);
        }
        newlyUnlocked.push({ key: ad.key, title: ad.title, geo_reward: ad.geo_reward, xp_reward: ad.xp_reward });
      }
    } catch (e) {
      console.error('[achievements] error on', ad.key, e?.message);
    }
  }

  return newlyUnlocked;
}

// ── Full game data for /api/me/game ──────────────────────────────────────────

async function getUserGameData(userId) {
  const today     = getTashkentDay();
  const weekStart = getWeekStart(today);

  const [
    { data: streak },
    { data: user },
    { data: tasks },
    { data: achievements },
    { data: referralsGiven },
    { data: referralEarnings },
    { data: taskDefs },
    { data: achievementDefs },
    boosts,
  ] = await Promise.all([
    supabase.from('user_streaks').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('users').select('xp, level, balance, referral_code').eq('id', userId).single(),
    supabase.from('user_tasks').select('*').eq('user_id', userId),
    supabase.from('user_achievements').select('achievement_key, unlocked_at').eq('user_id', userId),
    supabase.from('referrals').select('referred_id, activated, activated_at').eq('referrer_id', userId),
    supabase.from('referral_earnings').select('amount, created_at').eq('referrer_id', userId)
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('task_definitions').select('*'),
    supabase.from('achievement_definitions').select('*'),
    getActiveBoosts(0),
  ]);

  const streakData = streak || { current_streak: 0, longest_streak: 0, last_checkin_date: null, freeze_available: 0 };
  const xp = user?.xp || 0;
  const levelInfo = getLevelInfo(xp);

  const tasksWithProgress = (taskDefs || []).map(td => {
    const periodDate = td.type === 'daily' ? today : td.type === 'weekly' ? weekStart : '1970-01-01';
    const ut = (tasks || []).find(t => t.task_key === td.key && t.period_date === periodDate);
    return { ...td, progress: ut?.progress || 0, completed: ut?.completed || false, claimed: ut?.claimed || false };
  });

  const earnedKeys = new Set((achievements || []).map(a => a.achievement_key));
  const achievementsWithStatus = (achievementDefs || []).map(ad => ({
    ...ad,
    earned: earnedKeys.has(ad.key),
    unlocked_at: (achievements || []).find(a => a.achievement_key === ad.key)?.unlocked_at || null,
  }));

  const botUsername = process.env.BOT_USERNAME || 'GeoEarnBot';
  const referralCode = user?.referral_code || '';
  const totalEarned = (referralEarnings || []).reduce((s, r) => s + r.amount, 0);

  return {
    streak: streakData,
    projectedStreak: projectedStreak(streakData, today),
    xp,
    level: levelInfo.level,
    levelLabel: levelInfo.label,
    levelBonus: levelInfo.bonus,
    nextLevelXp: getNextLevelXp(xp),
    tasks: tasksWithProgress,
    achievements: achievementsWithStatus,
    referral: {
      code: referralCode,
      link: `https://t.me/${botUsername}?start=${referralCode}`,
      totalReferrals: (referralsGiven || []).length,
      activatedReferrals: (referralsGiven || []).filter(r => r.activated).length,
      totalEarned,
      recentEarnings: referralEarnings || [],
    },
    boosts,
  };
}

module.exports = {
  getTashkentDay,
  getWeekStart,
  getLevelInfo,
  getNextLevelXp,
  getStreakAndLevel,
  getActiveBoosts,
  computeMultipliers,
  applyStreakUpdate,
  grantXp,
  checkAndUpdateTasks,
  checkAchievements,
  getUserGameData,
};
