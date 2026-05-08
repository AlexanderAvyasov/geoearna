const { Bot } = require('grammy');
const startHandler = require('./handlers/start');
const balanceHandler = require('./handlers/balance');
const { withdrawHandler, withdrawFlow } = require('./handlers/withdraw');

const sessions = new Map();

const bot = new Bot(process.env.BOT_TOKEN);

bot.use(async (ctx, next) => {
  const telegramId = ctx.from?.id?.toString();

  if (telegramId) {
    if (!sessions.has(telegramId)) {
      sessions.set(telegramId, {});
    }

    ctx.session = sessions.get(telegramId);
  }

  await next();

  if (telegramId) {
    sessions.set(telegramId, ctx.session || {});
  }
});

bot.command('start', startHandler);
bot.command('balance', balanceHandler);
bot.command('withdraw', withdrawHandler);

bot.on('message:text', async (ctx) => {
  if (ctx.session?.withdraw?.stage) {
    const handled = await withdrawFlow(ctx);
    if (handled) {
      return;
    }
  }

  return ctx.reply('Я вас не понял. Используйте /start, /balance или /withdraw.');
});

bot.start();

module.exports = bot;
