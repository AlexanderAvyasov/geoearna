const { Keyboard, InlineKeyboard } = require('grammy');
const { supabase } = require('../../db/index');

async function startHandler(ctx) {
  const param      = ctx.match || null;
  const telegramId = String(ctx.from?.id);
  const username   = ctx.from?.username || null;
  const firstName  = ctx.from?.first_name || 'пользователь';

  if (!telegramId) return ctx.reply('Не удалось определить ваш Telegram ID.');

  if (!ctx.session) ctx.session = {};

  const isReferral  = param?.startsWith('ref_');
  const qrToken     = (!isReferral && param) ? param : null;
  const referralCode = isReferral ? param : null;

  if (qrToken) ctx.session.pendingQrToken = qrToken;

  const { data: existingUser, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (selectError) {
    console.error('start select error', selectError);
    return ctx.reply('Произошла ошибка. Попробуйте позже.');
  }

  if (!existingUser) {
    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert({ telegram_id: telegramId, username })
      .select('*')
      .single();

    if (insertError) {
      console.error('start insert error', insertError);
      return ctx.reply('Ошибка при регистрации. Попробуйте позже.');
    }

    if (referralCode) await recordReferral(insertedUser.id, referralCode);

    ctx.session.awaitingPhone = true;
    const phoneKeyboard = new Keyboard()
      .requestContact('📱 Поделиться номером')
      .resized()
      .oneTime();

    return ctx.reply(
      `👋 Добро пожаловать в GeoEarn, ${firstName}!\n\n` +
      `Посещайте заведения, сканируйте QR-коды и получайте GEO-монеты на свой счёт.\n\n` +
      `Поделитесь номером телефона для завершения регистрации:`,
      { reply_markup: phoneKeyboard }
    );
  }

  return sendMainMenu(ctx, existingUser);
}

async function recordReferral(newUserId, referralCode) {
  try {
    const { data: referrer } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', referralCode)
      .maybeSingle();
    if (!referrer || referrer.id === newUserId) return;
    await supabase.from('referrals').insert({ referrer_id: referrer.id, referred_id: newUserId });
  } catch (e) {
    console.error('[referral] error', e?.message);
  }
}

async function sendMainMenu(ctx, user) {
  const telegramId = String(ctx.from?.id || '');

  // Pending QR token — open checkin immediately
  const qrToken = ctx.session?.pendingQrToken;
  if (qrToken) {
    ctx.session.pendingQrToken = null;
    const base = process.env.WEBAPP_URL;
    let checkinUrl;
    if (qrToken.startsWith('gh_')) {
      checkinUrl = `${base}/checkin?token=${encodeURIComponent(qrToken.slice(3))}&geohunt=1`;
    } else if (qrToken.startsWith('promo_')) {
      checkinUrl = `${base}/checkin?token=${encodeURIComponent(qrToken)}&promo=1`;
    } else {
      checkinUrl = `${base}/checkin?token=${encodeURIComponent(qrToken)}`;
    }
    const kb = new InlineKeyboard().webApp('📍 Выполнить чекин', checkinUrl);
    return ctx.reply(
      'Найден QR-код заведения. Нажмите кнопку ниже для чекина:',
      { reply_markup: kb }
    );
  }

  // Check business ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  const balance = user?.balance || 0;

  const kb = new InlineKeyboard()
    .webApp('🚀 Открыть GeoEarn', process.env.WEBAPP_URL)
    .row()
    .text('💎 Баланс', 'action:balance')
    .text('📋 История', 'action:history')
    .row()
    .text('💳 Вывод средств', 'action:withdraw');

  if (business) {
    kb.row()
      .text('🏪 Мой QR', 'action:myqr')
      .text('🔐 Новый PIN', 'action:mypin');
  }

  const text =
    `👋 *${ctx.from?.first_name || 'Привет'}!*\n\n` +
    `💎 Баланс: *${balance.toLocaleString('ru-RU')} GEO*\n\n` +
    `Сканируйте QR-коды в заведениях и получайте вознаграждения.`;

  return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

async function handleContact(ctx) {
  try {
    const telegramId = String(ctx.from?.id);
    const phone = ctx.message?.contact?.phone_number;
    if (!phone) return;

    await supabase.from('users').update({ phone }).eq('telegram_id', telegramId);
    ctx.session.awaitingPhone = false;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    await ctx.reply('✅ Регистрация завершена!', { reply_markup: { remove_keyboard: true } });
    return sendMainMenu(ctx, user);
  } catch (error) {
    console.error('handleContact error', error);
    return ctx.reply('Ошибка при сохранении номера. Попробуйте позже.');
  }
}

module.exports = { startHandler, sendMainMenu, handleContact };
