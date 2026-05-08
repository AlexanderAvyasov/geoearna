const { Keyboard } = require('grammy');
const { supabase } = require('../../db/index');

async function startHandler(ctx) {
  try {
    const qrToken = ctx.match || null;
    const telegramId = String(ctx.from?.id);
    const username = ctx.from?.username || null;
    const firstName = ctx.from?.first_name || 'пользователь';

    if (!telegramId) {
      return ctx.reply('Не удалось определить ваш Telegram ID. Попробуйте снова.');
    }

    if (!ctx.session) ctx.session = {};
    if (qrToken) ctx.session.pendingQrToken = qrToken;

    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (selectError) {
      console.error('start select user error', selectError);
      return ctx.reply('Произошла ошибка. Попробуйте позже.');
    }

    if (!existingUser) {
      const { data: insertedUser, error: insertError } = await supabase
        .from('users')
        .insert({ telegram_id: telegramId, username })
        .select('*')
        .single();

      if (insertError) {
        console.error('start insert user error', insertError);
        return ctx.reply('Ошибка при регистрации. Попробуйте позже.');
      }

      ctx.session.awaitingPhone = true;
      const phoneKeyboard = new Keyboard()
        .requestContact('📱 Поделиться номером')
        .resized()
        .oneTime();

      return ctx.reply(
        `👋 Добро пожаловать в GeoEarn, ${firstName}!\n\n` +
        `Посещайте заведения, сканируйте QR-коды и получайте бонусы на свой счёт.\n\n` +
        `Для завершения регистрации поделитесь номером телефона — он нужен для вывода средств.`,
        { reply_markup: phoneKeyboard }
      );
    }

    return sendMainMenu(ctx, existingUser);
  } catch (error) {
    console.error('startHandler error', error);
    return ctx.reply('Произошла внутренняя ошибка. Попробуйте позже.');
  }
}

async function sendMainMenu(ctx, user) {
  const qrToken = ctx.session?.pendingQrToken || null;
  if (qrToken) {
    ctx.session.pendingQrToken = null;
    const webAppUrl = `${process.env.WEBAPP_URL}/checkin?token=${encodeURIComponent(qrToken)}`;
    const keyboard = new Keyboard().webApp('📍 Выполнить чекин', webAppUrl).resized();
    return ctx.reply('Найден QR-код заведения. Откройте приложение для чекина.', {
      reply_markup: keyboard,
    });
  }

  const webAppUrl = process.env.WEBAPP_URL;
  const keyboard = new Keyboard()
    .webApp('💼 Открыть GeoEarn', webAppUrl)
    .resized();

  return ctx.reply(
    `Добро пожаловать, ${ctx.from?.first_name || 'пользователь'}!\n\n` +
    `Баланс: *${(user?.balance || 0).toLocaleString('ru-RU')} сум*\n\n` +
    `Сканируйте QR-коды в заведениях и получайте вознаграждение.\n\n` +
    `Команды:\n/myqr — QR-код вашего заведения\n/mypin — одноразовый PIN для клиента`,
    { reply_markup: keyboard, parse_mode: 'Markdown' }
  );
}

async function handleContact(ctx) {
  try {
    const telegramId = String(ctx.from?.id);
    const phone = ctx.message?.contact?.phone_number;

    if (!phone) return;

    await supabase
      .from('users')
      .update({ phone })
      .eq('telegram_id', telegramId);

    ctx.session.awaitingPhone = false;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    await ctx.reply('✅ Номер телефона сохранён. Регистрация завершена!', {
      reply_markup: { remove_keyboard: true },
    });

    return sendMainMenu(ctx, user);
  } catch (error) {
    console.error('handleContact error', error);
    return ctx.reply('Ошибка при сохранении номера. Попробуйте позже.');
  }
}

module.exports = { startHandler, sendMainMenu, handleContact };
