const { supabase } = require('../../db/index');
const { sendMessage } = require('../../api/services/notify');

// 1st of month 10:00 Tashkent = 05:00 UTC
const MONTHLY_UTC_HOUR = 5;
// Node.js setTimeout max is 2^31-1 ms (~24.8 days). Use 1 day as safe chunk.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function sendMonthlySummaries() {
  try {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();

    const { data: monthVisits } = await supabase
      .from('visits')
      .select('user_id, reward_amount, business_id')
      .gte('created_at', monthAgo);

    if (!monthVisits || monthVisits.length === 0) return;

    // Aggregate per user
    const stats = {};
    for (const v of monthVisits) {
      if (!stats[v.user_id]) stats[v.user_id] = { visits: 0, geo: 0, businesses: new Set() };
      stats[v.user_id].visits += 1;
      stats[v.user_id].geo += v.reward_amount || 0;
      stats[v.user_id].businesses.add(v.business_id);
    }

    const userIds = Object.keys(stats).map(Number);
    const [{ data: users }, { data: streaks }] = await Promise.all([
      supabase.from('users').select('id, telegram_id, level').in('id', userIds),
      supabase.from('user_streaks').select('user_id, longest_streak').in('user_id', userIds),
    ]);

    const streakMap = Object.fromEntries((streaks || []).map(s => [s.user_id, s.longest_streak]));

    for (const user of (users || [])) {
      if (!user.telegram_id) continue;
      const s = stats[user.id];
      const longestStreak = streakMap[user.id] || 0;

      await sendMessage(
        user.telegram_id,
        `📅 *Итоги месяца*\n\n` +
        `📍 Чекинов: *${s.visits}*\n` +
        `🏪 Заведений: *${s.businesses.size}*\n` +
        `💰 Заработано: *${s.geo.toLocaleString('ru-RU')} GEO*\n` +
        `🔥 Рекорд стрика: *${longestStreak} дн.*\n` +
        `🎖 Уровень: *${user.level}*\n\n` +
        `Продолжайте в том же духе! 🚀`
      );

      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`[monthly] summaries sent to ${userIds.length} users`);
  } catch (err) {
    console.error('[monthly] error', err?.message);
  }
}

function startMonthlyTask() {
  function scheduleNext() {
    const now = new Date();
    // Next 1st of the month at 05:00 UTC
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, MONTHLY_UTC_HOUR, 0, 0, 0));
    if (next <= now) {
      next.setUTCMonth(next.getUTCMonth() + 1);
    }

    const delay = next.getTime() - now.getTime();

    // Break into ≤1-day chunks to avoid 32-bit overflow in setTimeout
    const safeDelay = Math.min(delay, ONE_DAY_MS);
    console.log(`[monthly] next summary in ${Math.round(delay / 3600000)} h`);

    setTimeout(() => {
      if (Date.now() >= next.getTime()) {
        sendMonthlySummaries();
      }
      scheduleNext();
    }, safeDelay);
  }

  scheduleNext();
}

module.exports = { startMonthlyTask };
