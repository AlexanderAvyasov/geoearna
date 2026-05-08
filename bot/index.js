const { Bot } = require('grammy');
const { startHandler, handleContact } = require('./handlers/start');
const balanceHandler = require('./handlers/balance');
const { withdrawHandler, withdrawFlow } = require('./handlers/withdraw');
const myqrHandler = require('./handlers/myqr');
const mypinHandler = require('./handlers/mypin');
const { startStreakTask } = require('./tasks/streak');

const sessions = new Map();

const bot = new Bot(process.env.BOT_TOKEN);

bot.use(async (ctx, next) => {
  const telegramId = ctx.from?.id?.toString();
  if (telegramId) {
    if (!sessions.has(telegramId)) sessions.set(telegramId, {});
    ctx.session = sessions.get(telegramId);
  }
  await next();
  if (telegramId) sessions.set(telegramId, ctx.session || {});
});

bot.command('start', startHandler);
bot.command('balance', balanceHandler);
bot.command('withdraw', withdrawHandler);
bot.command('myqr', myqrHandler);
bot.command('mypin', mypinHandler);

bot.on('message:contact', handleContact);

bot.on('message:text', async (ctx) => {
  if (ctx.session?.withdraw?.stage) {
    const handled = await withdrawFlow(ctx);
    if (handled) return;
  }
  return ctx.reply(
    'Используйте кнопку ниже или команды:\n/start — главное меню\n/balance — баланс\n/myqr — QR заведения\n/mypin — PIN для клиента'
  );
});

bot.start();
startStreakTask();

module.exports = bot;
