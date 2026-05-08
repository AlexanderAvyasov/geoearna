const { supabase } = require('../../db/index');
const { sendMessage } = require('../../api/services/notify');

async function sendStreakReminders() {
  try {
    const h48ago = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const h72ago = new Date(Date.now() - 72 * 3600 * 1000).toISOString();

    // Users who visited 48–72h ago (window: missed yesterday, not today)
    const { data: candidateVisits } = await supabase
      .from('visits')
      .select('user_id')
      .gte('created_at', h72ago)
      .lt('created_at', h48ago);

    if (!candidateVisits || candidateVisits.length === 0) return;

    const candidateIds = [...new Set(candidateVisits.map(v => v.user_id))];

    // Remove users who already visited in last 48h (still active)
    const { data: recentVisits } = await supabase
      .from('visits')
      .select('user_id')
      .gte('created_at', h48ago)
      .in('user_id', candidateIds);

    const activeIds = new Set((recentVisits || []).map(v => v.user_id));
    const toNotifyIds = candidateIds.filter(id => !activeIds.has(id));

    if (toNotifyIds.length === 0) return;

    const { data: users } = await supabase
      .from('users')
      .select('telegram_id')
      .in('id', toNotifyIds);

    for (const user of (users || [])) {
      await sendMessage(
        user.telegram_id,
        '⏰ *Не пропустите бонус!*\n\n' +
        'Вы давно не заходили в GeoEarn.\n' +
        'Посетите заведение сегодня и получите вознаграждение! 📍'
      );
      // 100ms pause to stay within Telegram rate limits (~30 msg/sec)
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`[streak] reminders sent to ${toNotifyIds.length} users`);
  } catch (err) {
    console.error('[streak] error', err?.message);
  }
}

function startStreakTask() {
  // Run once at startup (offset), then every 24h
  const INTERVAL_MS = 24 * 60 * 60 * 1000;
  setTimeout(() => {
    sendStreakReminders();
    setInterval(sendStreakReminders, INTERVAL_MS);
  }, 5 * 60 * 1000); // first run 5 minutes after bot starts
}

module.exports = { startStreakTask };
