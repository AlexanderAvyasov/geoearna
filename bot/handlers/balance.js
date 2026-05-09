const { Keyboard } = require('grammy');
const { supabase } = require('../../db/index');
const { getLevelInfo, getNextLevelXp } = require('../../api/services/gamification');
const { getGeoRate } = require('../../api/lib/geoRate');

const LEVEL_MIN = [0, 100, 250, 500, 1000, 2000, 3000, 3750, 4500, 5000];

function xpBar(xp, level) {
  const from = LEVEL_MIN[level - 1] || 0;
  const to = LEVEL_MIN[level] || null;
  if (!to) return '██████████'; // max level
  const pct = Math.min((xp - from) / (to - from), 1);
  const filled = Math.round(pct * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

async function balanceHandler(ctx) {
  try {
    const telegramId = String(ctx.from?.id);

    const [{ data: user }, { data: streak }] = await Promise.all([
      supabase.from('users').select('id, balance, xp, level').eq('telegram_id', telegramId).maybeSingle(),
      null,
    ]);

    if (!user) {
      return ctx.reply('Пользователь не найден. Отправьте /start для регистрации.');
    }

    const { data: streakRow } = await supabase
      .from('user_streaks')
      .select('current_streak, longest_streak')
      .eq('user_id', user.id)
      .maybeSingle();

    const geoRate = getGeoRate();
    const balance = user.balance || 0;
    const xp = user.xp || 0;
    const levelInfo = getLevelInfo(xp);
    const nextXp = getNextLevelXp(xp);
    const currentStreak = streakRow?.current_streak || 0;
    const longestStreak = streakRow?.longest_streak || 0;
    const uzsAmount = Math.round(balance * geoRate);
    const bonusPct = Math.round((levelInfo.bonus - 1) * 100);

    const bar = xpBar(xp, levelInfo.level);
    const xpLine = nextXp
      ? `⚡ XP: ${xp} / ${nextXp}  ${bar}`
      : `⚡ XP: ${xp}  ${bar}  MAX`;

    const text =
      `💼 *Баланс GeoEarn*\n\n` +
      `💎 *${balance.toLocaleString('ru-RU')} GEO*\n` +
      `💵 ≈ ${uzsAmount.toLocaleString('ru-RU')} UZS\n\n` +
      `🎖 Уровень ${levelInfo.level} — *${levelInfo.label}*` +
      (bonusPct > 0 ? ` (+${bonusPct}% к наградам)` : '') + `\n` +
      `${xpLine}\n\n` +
      `🔥 Стрик: *${currentStreak} дн.*  |  Рекорд: ${longestStreak} дн.`;

    const keyboard = new Keyboard()
      .webApp('📷 Зачекиниться', `${process.env.WEBAPP_URL}/checkin`)
      .row()
      .webApp('💼 Открыть GeoEarn', process.env.WEBAPP_URL)
      .resized();

    return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } catch (error) {
    console.error('balanceHandler error', error);
    return ctx.reply('Произошла внутренняя ошибка. Попробуйте позже.');
  }
}

module.exports = balanceHandler;
