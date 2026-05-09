const { supabase } = require('../../db/index');
const { sendMessage } = require('../../api/services/notify');

// 03:00 UTC = 08:00 Tashkent — daily missions reset
const MISSIONS_UTC_HOUR = 3;

async function sendMissionsNotifications() {
  try {
    // Notify users who checked in within the last 3 days (active audience)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: activeStreaks } = await supabase
      .from('user_streaks')
      .select('user_id')
      .gte('last_checkin_date', threeDaysAgo);

    if (!activeStreaks || activeStreaks.length === 0) return;

    const userIds = activeStreaks.map(s => s.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, telegram_id')
      .in('id', userIds);

    for (const user of (users || [])) {
      if (!user.telegram_id) continue;

      await sendMessage(
        user.telegram_id,
        `🎯 *Новые ежедневные задания!*\n\n` +
        `Ваши задания на сегодня обновились.\n` +
        `Выполняйте задания и зарабатывайте дополнительные GEO и XP! ⚡`
      );

      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`[missions] notified ${userIds.length} active users`);
  } catch (err) {
    console.error('[missions] error', err?.message);
  }
}

function startMissionsTask() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(MISSIONS_UTC_HOUR, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  const delay = next.getTime() - now.getTime();
  console.log(`[missions] next notification in ${Math.round(delay / 60000)} min`);

  setTimeout(() => {
    sendMissionsNotifications();
    setInterval(sendMissionsNotifications, 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = { startMissionsTask };
