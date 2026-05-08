const { supabase } = require('../../db/index');

async function balanceHandler(ctx) {
  try {
    const telegramId = String(ctx.from?.id);

    if (!telegramId) {
      return ctx.reply('Не удалось определить ваш Telegram ID.');
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('balance')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (error) {
      console.error('balanceHandler error', error);
      return ctx.reply('Произошла ошибка при запросе баланса. Попробуйте позже.');
    }

    if (!user) {
      return ctx.reply('Пользователь не найден. Отправьте /start для регистрации.');
    }

    return ctx.reply(`Ваш баланс: ${user.balance} сум`);
  } catch (error) {
    console.error('balanceHandler exception', error);
    return ctx.reply('Произошла внутренняя ошибка. Попробуйте позже.');
  }
}

module.exports = balanceHandler;
