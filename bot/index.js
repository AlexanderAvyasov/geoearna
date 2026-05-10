const { Bot } = require('grammy');
const { supabase } = require('../db/index');
const { startHandler, sendMainMenu, handleContact } = require('./handlers/start');
const { balanceAction }                             = require('./handlers/balance');
const { historyAction }                             = require('./handlers/history');
const { withdrawAction, withdrawFlow }              = require('./handlers/withdraw');
const { myqrAction }                                = require('./handlers/myqr');
const { mypinAction }                               = require('./handlers/mypin');
const { startStreakTask }                           = require('./tasks/streak');
const { startWeeklyTask }                           = require('./tasks/weekly');
const { startMonthlyTask }                          = require('./tasks/monthly');
const { startReengagementTask }                     = require('./tasks/reengagement');
const { startMissionsTask }                         = require('./tasks/missions');

const sessions = new Map();

const bot = new Bot(process.env.BOT_TOKEN);

// ── Session middleware ──────────────────────────────────────────────────────────
bot.use(async (ctx, next) => {
  const telegramId = ctx.from?.id?.toString();
  if (telegramId) {
    if (!sessions.has(telegramId)) sessions.set(telegramId, {});
    ctx.session = sessions.get(telegramId);
  }
  await next();
  if (telegramId) sessions.set(telegramId, ctx.session || {});
});

// ── Commands ───────────────────────────────────────────────────────────────────
bot.command('start', startHandler);

// ── Callback queries (inline buttons) ─────────────────────────────────────────
bot.callbackQuery('action:balance',  balanceAction);
bot.callbackQuery('action:history',  historyAction);
bot.callbackQuery('action:withdraw', withdrawAction);
bot.callbackQuery('action:myqr',     myqrAction);
bot.callbackQuery('action:mypin',    mypinAction);

bot.callbackQuery('action:menu', async (ctx) => {
  ctx.answerCallbackQuery().catch(() => {});
  const telegramId = String(ctx.from?.id);
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  return sendMainMenu(ctx, user || {});
});

// ── Phone contact (registration) ───────────────────────────────────────────────
bot.on('message:contact', handleContact);

// ── Text messages (withdraw flow or unknown) ───────────────────────────────────
bot.on('message:text', async (ctx) => {
  // Active withdrawal flow takes priority
  if (ctx.session?.withdraw?.stage) {
    const handled = await withdrawFlow(ctx);
    if (handled) return;
  }

  // Everything else — show the main menu
  const telegramId = String(ctx.from?.id);
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (user) return sendMainMenu(ctx, user);
  return ctx.reply('Отправьте /start для начала работы.');
});

// ── Global error handler (prevents unhandled rejections from crashing the process) ──
bot.catch((err) => {
  console.error('[bot] Unhandled error:', err.message || err);
});

// ── Scheduled tasks ────────────────────────────────────────────────────────────
startStreakTask();
startWeeklyTask();
startMonthlyTask();
startReengagementTask();
startMissionsTask();

module.exports = { bot };
