const { InlineKeyboard } = require('grammy');
const { supabase } = require('../../db/index');
const { getLevelInfo, getNextLevelXp } = require('../../api/services/gamification');
const { getGeoRate } = require('../../api/lib/geoRate');

const LEVEL_MIN = [0, 100, 250, 500, 1000, 2000, 3000, 3750, 4500, 5000];

function xpBar(xp, level) {
  const from = LEVEL_MIN[level - 1] || 0;
  const to   = LEVEL_MIN[level]     || null;
  if (!to) return '██████████';
  const pct    = Math.min((xp - from) / (to - from), 1);
  const filled = Math.round(pct * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

async function balanceAction(ctx) {
  await ctx.answerCallbackQuery();
  const telegramId = String(ctx.from?.id);

  const { data: user } = await supabase
    .from('users')
    .select('id, balance, xp, level')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (!user) {
    return ctx.reply('Пользователь не найден. Отправьте /start.');
  }

  const { data: streakRow } = await supabase
    .from('user_streaks')
    .select('current_streak, longest_streak')
    .eq('user_id', user.id)
    .maybeSingle();

  const geoRate      = getGeoRate();
  const balance      = user.balance || 0;
  const xp           = user.xp || 0;
  const levelInfo    = getLevelInfo(xp);
  const nextXp       = getNextLevelXp(xp);
  const streak       = streakRow?.current_streak || 0;
  const longestStreak = streakRow?.longest_streak || 0;
  const uzsAmount    = Math.round(balance * geoRate);
  const bonusPct     = Math.round((levelInfo.bonus - 1) * 100);
  const bar          = xpBar(xp, levelInfo.level);
  const xpLine       = nextXp
    ? `⚡ XP: ${xp} / ${nextXp}  ${bar}`
    : `⚡ XP: ${xp}  ${bar}  MAX`;

  const text =
    `💼 *Баланс GeoEarn*\n\n` +
    `💎 *${balance.toLocaleString('ru-RU')} GEO*\n` +
    `💵 ≈ ${uzsAmount.toLocaleString('ru-RU')} UZS\n\n` +
    `🎖 Уровень ${levelInfo.level} — *${levelInfo.label}*` +
    (bonusPct > 0 ? ` (+${bonusPct}% к наградам)` : '') + `\n` +
    `${xpLine}\n\n` +
    `🔥 Стрик: *${streak} дн.* | Рекорд: ${longestStreak} дн.`;

  const kb = new InlineKeyboard()
    .webApp('📊 Открыть GeoEarn', process.env.WEBAPP_URL)
    .row()
    .text('« Назад', 'action:menu');

  return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

module.exports = { balanceAction };
