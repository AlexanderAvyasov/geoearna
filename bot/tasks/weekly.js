const { supabase } = require('../../db/index');
const { sendMessage } = require('../../api/services/notify');

// Sunday 20:00 Tashkent = 15:00 UTC
const WEEKLY_UTC_HOUR = 15;
const WEEKLY_UTC_DOW  = 0; // Sunday

async function sendWeeklySummaries() {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Users with at least 1 visit this week
    const { data: weekVisits } = await supabase
      .from('visits')
      .select('user_id, reward_amount')
      .gte('created_at', weekAgo);

    if (!weekVisits || weekVisits.length === 0) return;

    // Aggregate per user
    const stats = {};
    for (const v of weekVisits) {
      if (!stats[v.user_id]) stats[v.user_id] = { visits: 0, geo: 0 };
      stats[v.user_id].visits += 1;
      stats[v.user_id].geo += v.reward_amount || 0;
    }

    const userIds = Object.keys(stats).map(Number);
    const { data: users } = await supabase
      .from('users')
      .select('id, telegram_id, xp, level')
      .in('id', userIds);

    for (const user of (users || [])) {
      if (!user.telegram_id) continue;
      const s = stats[user.id];

      await sendMessage(
        user.telegram_id,
        `📊 *Итоги недели*\n\n` +
        `📍 Чекинов: *${s.visits}*\n` +
        `💰 Заработано: *${s.geo.toLocaleString('ru-RU')} GEO*\n` +
        `🎖 Уровень: *${user.level}*\n\n` +
        `Новая неделя — новые возможности! 🚀`
      );

      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`[weekly] summaries sent to ${userIds.length} users`);
  } catch (err) {
    console.error('[weekly] error', err?.message);
  }
}

function startWeeklyTask() {
  function scheduleNext() {
    const now = new Date();
    const next = new Date(now);

    // Find next Sunday
    const daysUntilSunday = (7 - now.getUTCDay()) % 7;
    next.setUTCDate(next.getUTCDate() + daysUntilSunday);
    next.setUTCHours(WEEKLY_UTC_HOUR, 0, 0, 0);

    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 7);
    }

    const delay = next.getTime() - now.getTime();
    console.log(`[weekly] next summary in ${Math.round(delay / 60000)} min`);

    setTimeout(() => {
      sendWeeklySummaries();
      setInterval(sendWeeklySummaries, 7 * 24 * 60 * 60 * 1000);
    }, delay);
  }

  scheduleNext();
}

module.exports = { startWeeklyTask };
