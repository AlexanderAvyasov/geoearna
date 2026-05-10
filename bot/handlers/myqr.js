const { InlineKeyboard, InputFile } = require('grammy');
const QRCode = require('qrcode');
const { supabase } = require('../../db/index');

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

  const checkinUrl = `${process.env.WEBAPP_URL}/checkin?token=${encodeURIComponent(business.qr_token)}`;
  const qrBuffer   = await QRCode.toBuffer(checkinUrl, { width: 512, margin: 2 });

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
