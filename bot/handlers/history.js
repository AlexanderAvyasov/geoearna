const { supabase } = require('../../db/index');
const { getGeoRate } = require('../../api/lib/geoRate');

const STATUS_ICON = { pending: '⏳', approved: '✅', rejected: '❌' };

async function historyHandler(ctx) {
  try {
    const telegramId = String(ctx.from?.id);

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (!user) {
      return ctx.reply('Пользователь не найден. Отправьте /start для регистрации.');
    }

    const { data: withdrawals } = await supabase
      .from('withdrawals')
      .select('amount, phone, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!withdrawals || withdrawals.length === 0) {
      return ctx.reply('У вас ещё нет заявок на вывод.');
    }

    const geoRate = getGeoRate();

    const lines = withdrawals.map(w => {
      const icon = STATUS_ICON[w.status] || '❓';
      const date = new Date(w.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
      const uzs = Math.round(w.amount * geoRate).toLocaleString('ru-RU');
      return `${icon} *${w.amount.toLocaleString('ru-RU')} GEO* (${uzs} UZS) — ${date}`;
    });

    const text = `📋 *Последние выводы*\n\n${lines.join('\n')}`;

    return ctx.reply(text, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('historyHandler error', error);
    return ctx.reply('Произошла внутренняя ошибка. Попробуйте позже.');
  }
}

module.exports = historyHandler;
