const { InlineKeyboard } = require('grammy');
const { supabase } = require('../../db/index');
const { getGeoRate } = require('../../api/lib/geoRate');

const STATUS_LABEL = {
  pending:  '⏳ Ожидает',
  approved: '✅ Выплачено',
  rejected: '❌ Отклонено',
};

function maskCard(card) {
  const digits = String(card || '').replace(/\D/g, '');
  if (digits.length >= 4) return `**** ${digits.slice(-4)}`;
  return card || '—';
}

async function historyAction(ctx) {
  ctx.answerCallbackQuery().catch(() => {});
  const telegramId = String(ctx.from?.id);

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (!user) return ctx.reply('Пользователь не найден. Отправьте /start.');

  const { data: withdrawals } = await supabase
    .from('withdrawals')
    .select('amount, phone, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const kb = new InlineKeyboard()
    .webApp('💼 Все выводы в приложении', process.env.WEBAPP_URL)
    .row()
    .text('« Назад', 'action:menu');

  if (!withdrawals || withdrawals.length === 0) {
    return ctx.reply('У вас ещё нет заявок на вывод.', { reply_markup: kb });
  }

  const geoRate = getGeoRate();

  const lines = withdrawals.map(w => {
    const label = STATUS_LABEL[w.status] || '❓';
    const date  = new Date(w.created_at).toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    });
    const uzs = Math.round(w.amount * geoRate).toLocaleString('ru-RU');
    return `${label}\n*${w.amount.toLocaleString('ru-RU')} GEO* (${uzs} UZS)\nКарта: \`${maskCard(w.phone)}\` — ${date}`;
  });

  const text = `📋 *Последние заявки на вывод*\n\n${lines.join('\n\n')}`;

  return ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb });
}

module.exports = { historyAction };
