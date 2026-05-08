const { Keyboard } = require('grammy');
const { supabase } = require('../../db/index');

async function startHandler(ctx) {
  try {
    const qrToken = ctx.match || null;
    const telegramId = String(ctx.from?.id);
    const username = ctx.from?.username || null;

    if (!telegramId) {
      return ctx.reply('Не удалось определить вашего Telegram ID. Попробуйте снова.');
    }

    if (!ctx.session) {
      ctx.session = {};
    }

    if (qrToken) {
      ctx.session.qrToken = qrToken;
    }

    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (selectError) {
      console.error('start select user error', selectError);
      return ctx.reply('Произошла ошибка при обработке команды. Попробуйте позже.');
    }

    let user = existingUser;

    if (!user) {
      const { data: insertedUser, error: insertError } = await supabase
        .from('users')
        .insert({ telegram_id: telegramId, username })
        .select('*')
        .single();

      if (insertError) {
        console.error('start insert user error', insertError);
        return ctx.reply('Произошла ошибка при регистрации. Попробуйте позже.');
      }

      user = insertedUser;
    }

    if (qrToken) {
      const webAppUrl = `${process.env.WEBAPP_URL}/checkin?token=${encodeURIComponent(qrToken)}`;
      const keyboard = new Keyboard().webApp('Открыть приложение', webAppUrl).resized();

      return ctx.reply(
        'Найден QR-код заведения. Откройте приложение для чекина.',
        {
          reply_markup: keyboard,
        }
      );
    }

    const webAppUrl = `${process.env.WEBAPP_URL}`;
    const keyboard = new Keyboard()
      .webApp('Мои визиты и баланс', webAppUrl)
      .text('Запросить вывод')
      .resized();

    return ctx.reply(
      'Добро пожаловать в GeoEarn! Вы можете открыть приложение или запросить вывод средств.',
      {
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    console.error('startHandler error', error);
    return ctx.reply('Произошла внутренняя ошибка. Попробуйте позже.');
  }
}

module.exports = startHandler;
