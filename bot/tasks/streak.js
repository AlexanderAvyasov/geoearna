const { supabase } = require('../../db/index');
const { sendMessage } = require('../../api/services/notify');

// 20:00 Tashkent = 15:00 UTC
const REMINDER_UTC_HOUR = 15;

async function sendStreakReminders() {
  try {
    // Find users whose last_checkin_date was yesterday (Tashkent game day).
    // We can't easily compute the game day in SQL, so we approximate:
    // "last check-in was exactly 1 calendar day ago in UTC" is close enough for reminders.
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD

    const { data: atRisk } = await supabase
      .from('user_streaks')
      .select('user_id, current_streak, freeze_available')
      .eq('last_checkin_date', yesterdayStr)
      .gt('current_streak', 0);

    if (!atRisk || atRisk.length === 0) return;

    const userIds = atRisk.map(r => r.user_id);

    const { data: users } = await supabase
      .from('users')
      .select('id, telegram_id')
      .in('id', userIds);

    const userMap = Object.fromEntries((users || []).map(u => [u.id, u.telegram_id]));

    for (const row of atRisk) {
      const telegramId = userMap[row.user_id];
      if (!telegramId) continue;

      const streak = row.current_streak;
      const hasFreeze = row.freeze_available > 0;

      const freezeNote = hasFreeze
        ? '\n❄️ У вас есть заморозка — она защитит ваш стрик, но лучше зайти сегодня!'
        : '';

      await sendMessage(
        telegramId,
        `🔥 *Ваш ${streak}-дневный стрик под угрозой!*\n\n` +
        `Вы ещё не заходили сегодня. Посетите заведение и сохраните свою серию!${freezeNote} 📍`
      );

      // 100ms pause to stay within Telegram rate limits (~30 msg/sec)
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`[streak] reminders sent to ${atRisk.length} users`);
  } catch (err) {
    console.error('[streak] error', err?.message);
  }
}

// Schedule the reminder to fire at 15:00 UTC (= 20:00 Tashkent) every day.
function startStreakTask() {
  const now = new Date();
  const nextFire = new Date(now);
  nextFire.setUTCHours(REMINDER_UTC_HOUR, 0, 0, 0);
  if (nextFire <= now) nextFire.setUTCDate(nextFire.getUTCDate() + 1);

  const msUntilFirst = nextFire.getTime() - now.getTime();

  setTimeout(() => {
    sendStreakReminders();
    setInterval(sendStreakReminders, 24 * 60 * 60 * 1000);
  }, msUntilFirst);

  console.log(`[streak] next reminder scheduled in ${Math.round(msUntilFirst / 60000)} minutes`);
}

module.exports = { startStreakTask };
