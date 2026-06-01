const { InlineKeyboard, InputFile } = require('grammy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { supabase } = require('../../db/index');

function buildCheckinDeepLink(token) {
  const bot = process.env.BOT_USERNAME || 'GeoEarnBot';
  const app = process.env.BOT_APP_SHORT_NAME;
  return app
    ? `https://t.me/${bot}/${app}?startapp=${token}`
    : `https://t.me/${bot}?start=${token}`;
}

async function myqrAction(ctx) {
  ctx.answerCallbackQuery().catch(() => {});
  const telegramId = String(ctx.from?.id);

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, qr_token')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (error || !business) {
    const kb = new InlineKeyboard().text('« Назад', 'action:menu');
    return ctx.reply(
      'Вы не зарегистрированы как владелец заведения. Обратитесь к администратору.',
      { reply_markup: kb }
    );
  }

  // Auto-generate qr_token if the business was created without one
  if (!business.qr_token) {
    business.qr_token = crypto.randomBytes(24).toString('hex');
    await supabase.from('businesses').update({ qr_token: business.qr_token }).eq('id', business.id);
  }

  const deepLink = buildCheckinDeepLink(business.qr_token);
  const qrBuffer = await QRCode.toBuffer(deepLink, { width: 512, margin: 2 });

  const kb = new InlineKeyboard()
    .webApp('🏪 Панель заведения', `${process.env.WEBAPP_URL}/admin`)
    .row()
    .text('🔐 Новый PIN', 'action:mypin')
    .text('« Назад', 'action:menu');

  await ctx.replyWithPhoto(new InputFile(qrBuffer, 'qr.png'), {
    caption:
      `🏪 *${business.name}*\n\n` +
      `Этот QR-код ведёт клиентов на чекин в вашем заведении.\n\n` +
      `Разместите его на видном месте — посетители сканируют и получают GEO-бонусы.`,
    parse_mode: 'Markdown',
    reply_markup: kb,
  });
}

module.exports = { myqrAction };
