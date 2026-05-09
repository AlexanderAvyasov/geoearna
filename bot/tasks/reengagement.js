const { supabase } = require('../../db/index');
const { sendMessage } = require('../../api/services/notify');

// 12:00 UTC = 17:00 Tashkent
const REENG_UTC_HOUR = 12;

async function sendReengagementReminders() {
  try {
    const now = new Date();

    const daysAgo3  = new Date(now.getTime() - 3  * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const daysAgo7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const daysAgo14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // 3-day inactive: gentle reminder
    const { data: threeDay } = await supabase
      .from('user_streaks')
      .select('user_id, current_streak')
      .eq('last_checkin_date', daysAgo3)
      .gt('current_streak', 0);

    // 7-day inactive: stronger reminder
    const { data: sevenDay } = await supabase
      .from('user_streaks')
      .select('user_id, current_streak')
      .eq('last_checkin_date', daysAgo7);

    // 14-day inactive: win-back
    const { data: fourteenDay } = await supabase
      .from('user_streaks')
      .select('user_id')
      .eq('last_checkin_date', daysAgo14);

    const allUserIds = [
      ...(threeDay  || []).map(r => r.user_id),
      ...(sevenDay  || []).map(r => r.user_id),
      ...(fourteenDay || []).map(r => r.user_id),
    ];

    if (allUserIds.length === 0) return;

    const { data: users } = await supabase
      .from('users')
      .select('id, telegram_id')
      .in('id', allUserIds);

    const userMap = Object.fromEntries((users || []).map(u => [u.id, u.telegram_id]));

    const pause = () => new Promise(r => setTimeout(r, 100));

    for (const row of (threeDay || [])) {
      const tid = userMap[row.user_id];
      if (!tid) continue;
      await sendMessage(tid,
        `👋 *Пора зачекиниться!*\n\n` +
        `Вы не заходили 3 дня. Посетите заведение и продолжите зарабатывать GEO! 📍`
      );
      await pause();
    }

    for (const row of (sevenDay || [])) {
      const tid = userMap[row.user_id];
      if (!tid) continue;
      await sendMessage(tid,
        `😔 *Мы скучаем по вам!*\n\n` +
        `7 дней без чекина. Заведения ждут — возвращайтесь и получайте бонусы! 🏆`
      );
      await pause();
    }

    for (const row of (fourteenDay || [])) {
      const tid = userMap[row.user_id];
      if (!tid) continue;
      await sendMessage(tid,
        `🎁 *Специальное предложение!*\n\n` +
        `Вас не было 2 недели. Вернитесь сегодня — вас ждут свежие кампании и бонусы! 🚀\n\n` +
        `Открыть GeoEarn ↓`
      );
      await pause();
    }

    const total = (threeDay?.length || 0) + (sevenDay?.length || 0) + (fourteenDay?.length || 0);
    console.log(`[reengagement] sent ${total} reminders`);
  } catch (err) {
    console.error('[reengagement] error', err?.message);
  }
}

function startReengagementTask() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(REENG_UTC_HOUR, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

  const delay = next.getTime() - now.getTime();
  console.log(`[reengagement] next run in ${Math.round(delay / 60000)} min`);

  setTimeout(() => {
    sendReengagementReminders();
    setInterval(sendReengagementReminders, 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = { startReengagementTask };
