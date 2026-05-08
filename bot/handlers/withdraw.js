const { supabase } = require('../../db/index');

async function withdrawHandler(ctx) {
  try {
    if (!ctx.session) {
      ctx.session = {};
    }

    ctx.session.withdraw = {
      stage: 'phone',
    };

    return ctx.reply('Пожалуйста, отправьте номер телефона Payme для вывода.', {
      reply_markup: {
        force_reply: true,
        selective: true,
      },
    });
  } catch (error) {
    console.error('withdrawHandler error', error);
    return ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
}

async function withdrawFlow(ctx) {
  try {
    if (!ctx.session || !ctx.session.withdraw) {
      return false;
    }

    const { stage, phone } = ctx.session.withdraw;
    const text = ctx.message?.text?.trim();

    if (!text) {
      return ctx.reply('Введите текстовым сообщением номер телефона или сумму.');
    }

    if (stage === 'phone') {
      ctx.session.withdraw.phone = text;
      ctx.session.withdraw.stage = 'amount';

      return ctx.reply('Введите сумму для вывода.', {
        reply_markup: {
          force_reply: true,
          selective: true,
        },
      });
    }

    if (stage === 'amount') {
      const amount = Number(text.replace(/\s+/g, '').replace(',', '.'));

      if (!Number.isFinite(amount) || amount <= 0) {
        return ctx.reply('Введите корректную сумму для вывода.');
      }

      const telegramId = String(ctx.from?.id);

      if (!telegramId) {
        return ctx.reply('Не удалось определить ваш Telegram ID.');
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, balance')
        .eq('telegram_id', telegramId)
        .maybeSingle();

      if (userError) {
        console.error('withdrawFlow user lookup error', userError);
        return ctx.reply('Произошла ошибка при обработке запроса. Попробуйте позже.');
      }

      if (!user) {
        return ctx.reply('Пользователь не найден. Отправьте /start для регистрации.');
      }

      if (amount > user.balance) {
        ctx.session.withdraw = null;
        return ctx.reply('Недостаточно средств для вывода.');
      }

      const newBalance = user.balance - amount;
      const { error: updateError } = await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('id', user.id);

      if (updateError) {
        console.error('withdrawFlow update balance error', updateError);
        return ctx.reply('Не удалось обновить баланс. Попробуйте позже.');
      }

      const { error: insertError } = await supabase.from('withdrawals').insert({
        user_id: user.id,
        amount,
        phone,
        status: 'pending',
      });

      if (insertError) {
        console.error('withdrawFlow insert withdrawal error', insertError);
        await supabase.from('users').update({ balance: user.balance }).eq('id', user.id);
        return ctx.reply('Не удалось создать заявку. Попробуйте позже.');
      }

      ctx.session.withdraw = null;
      return ctx.reply('Заявка принята, перевод в течение 24 часов.');
    }

    return false;
  } catch (error) {
    console.error('withdrawFlow exception', error);
    return ctx.reply('Произошла внутренняя ошибка. Попробуйте позже.');
  }
}

module.exports = {
  withdrawHandler,
  withdrawFlow,
};
