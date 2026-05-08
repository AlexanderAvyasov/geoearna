const { supabase } = require('../../db/index');

async function mypinHandler(ctx) {
  const telegramId = String(ctx.from?.id);

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_telegram_id', telegramId)
    .maybeSingle();

  if (error || !business) {
    return ctx.reply('Вы не зарегистрированы как владелец заведения.');
  }

  const pin = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const { error: insertError } = await supabase
    .from('verification_pins')
    .insert({ business_id: business.id, pin, expires_at: expiresAt.toISOString() });

  if (insertError) {
    return ctx.reply('Ошибка генерации PIN. Попробуйте позже.');
  }

  const expiresStr = expiresAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return ctx.reply(
    `🔐 *PIN-код для "${business.name}"*\n\n` +
    `\`${pin}\`\n\n` +
    `_Действителен до ${expiresStr} (15 минут)_\n\n` +
    `Назовите этот код клиенту для подтверждения визита.`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = mypinHandler;
