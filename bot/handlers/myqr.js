const QRCode = require('qrcode');
const { InputFile } = require('grammy');
const { supabase } = require('../../db/index');

async function myqrHandler(ctx) {
  const telegramId = String(ctx.from?.id);

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, qr_token')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (error || !business) {
    return ctx.reply('Вы не зарегистрированы как владелец заведения. Обратитесь к администратору.');
  }

  const checkinUrl = `${process.env.WEBAPP_URL}/checkin?token=${encodeURIComponent(business.qr_token)}`;
  const qrBuffer = await QRCode.toBuffer(checkinUrl, { width: 512, margin: 2 });

  await ctx.replyWithPhoto(new InputFile(qrBuffer, 'qr.png'), {
    caption:
      `QR-код для заведения "${business.name}"\n\n` +
      `Разместите этот код в заведении. Клиенты сканируют его для чекина и получения бонусов.`,
  });
}

module.exports = myqrHandler;
