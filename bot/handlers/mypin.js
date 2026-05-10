const { InlineKeyboard } = require('grammy');
const { supabase } = require('../../db/index');

async function mypinAction(ctx) {
  ctx.answerCallbackQuery().catch(() => {});
  const telegramId = String(ctx.from?.id);

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (error || !business) {
    const kb = new InlineKeyboard().text('« Назад', 'action:menu');
    return ctx.reply('Вы не зарегистрированы как владелец заведения.', { reply_markup: kb });
  }

  const pin       = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const { error: insertError } = await supabase
    .from('verification_pins')
    .insert({ business_id: business.id, pin, expires_at: expiresAt.toISOString() });

  if (insertError) {
    const kb = new InlineKeyboard().text('« Назад', 'action:menu');
    return ctx.reply('Ошибка генерации PIN. Попробуйте позже.', { reply_markup: kb });
  }

  const expiresStr = expiresAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const kb = new InlineKeyboard()
    .text('🔄 Новый PIN', 'action:mypin')
    .text('« Назад', 'action:menu');

  return ctx.reply(
    `🔐 *PIN-код для "${business.name}"*\n\n` +
    `\`${pin}\`\n\n` +
    `Действителен до *${expiresStr}* (15 минут)\n\n` +
    `Назовите этот код посетителю — он вводит его при чекине.`,
    { parse_mode: 'Markdown', reply_markup: kb }
  );
}

module.exports = { mypinAction };
