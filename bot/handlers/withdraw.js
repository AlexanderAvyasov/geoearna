const { InlineKeyboard } = require('grammy');
const { supabase } = require('../../db/index');
const { getGeoRate } = require('../../api/lib/geoRate');

const CARD_RE     = /^\d{16}$/;
const MIN_WITHDRAW = 100;

function maskCard(card) {
  return `**** **** **** ${String(card).slice(-4)}`;
}

function detectNetwork(card) {
  if (String(card).startsWith('9860')) return 'Humo';
  if (String(card).startsWith('8600')) return 'Uzcard';
  return null;
}

function cancelKb() {
  return new InlineKeyboard().text('Отмена', 'action:menu');
}

async function withdrawAction(ctx) {
  ctx.answerCallbackQuery().catch(() => {});

  const telegramId = String(ctx.from?.id);
  const { data: user } = await supabase
    .from('users')
    .select('id, balance')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (!user) {
    return ctx.reply('Пользователь не найден. Отправьте /start.');
  }

  if (user.balance < MIN_WITHDRAW) {
    const kb = new InlineKeyboard().text('« Назад', 'action:menu');
    return ctx.reply(
      `Недостаточно средств для вывода.\n\nМинимум — *${MIN_WITHDRAW} GEO*, у вас — *${user.balance} GEO*.`,
      { parse_mode: 'Markdown', reply_markup: kb }
    );
  }

  ctx.session.withdraw = { stage: 'card' };

  return ctx.reply(
    `💳 *Вывод средств*\n\n` +
    `Баланс: *${user.balance.toLocaleString('ru-RU')} GEO*\n\n` +
    `Введите номер банковской карты Humo или Uzcard (16 цифр):`,
    { parse_mode: 'Markdown', reply_markup: cancelKb() }
  );
}

async function withdrawFlow(ctx) {
  if (!ctx.session?.withdraw?.stage) return false;

  const { stage } = ctx.session.withdraw;
  const text = ctx.message?.text?.trim();
  if (!text) return false;

  // ── Stage 1: card number ────────────────────────────────────────────────────
  if (stage === 'card') {
    const digits = text.replace(/[\s\-]/g, '');

    if (!CARD_RE.test(digits)) {
      await ctx.reply(
        'Неверный формат. Введите 16 цифр карты без пробелов и дефисов.',
        { reply_markup: cancelKb() }
      );
      return true;
    }

    const network = detectNetwork(digits);
    if (!network) {
      await ctx.reply(
        'Принимаются только карты Humo (начинается на 9860) и Uzcard (начинается на 8600).',
        { reply_markup: cancelKb() }
      );
      return true;
    }

    ctx.session.withdraw.card  = digits;
    ctx.session.withdraw.stage = 'amount';

    const telegramId = String(ctx.from?.id);
    const { data: user } = await supabase
      .from('users')
      .select('balance')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    await ctx.reply(
      `${network === 'Humo' ? '🟡' : '🔵'} Карта ${network}: \`${maskCard(digits)}\`\n\n` +
      `Доступно: *${(user?.balance || 0).toLocaleString('ru-RU')} GEO*\n\n` +
      `Введите сумму для вывода (минимум ${MIN_WITHDRAW} GEO):`,
      { parse_mode: 'Markdown', reply_markup: cancelKb() }
    );
    return true;
  }

  // ── Stage 2: amount ─────────────────────────────────────────────────────────
  if (stage === 'amount') {
    const amount = parseInt(text.replace(/[\s,\.]/g, ''), 10);

    if (!Number.isInteger(amount) || amount <= 0) {
      await ctx.reply('Введите целое число — количество GEO.', { reply_markup: cancelKb() });
      return true;
    }

    if (amount < MIN_WITHDRAW) {
      await ctx.reply(`Минимальная сумма вывода — ${MIN_WITHDRAW} GEO.`, { reply_markup: cancelKb() });
      return true;
    }

    const telegramId = String(ctx.from?.id);
    const { data: user } = await supabase
      .from('users')
      .select('id, balance')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (!user) {
      ctx.session.withdraw = null;
      return ctx.reply('Пользователь не найден. Отправьте /start.');
    }

    if (amount > user.balance) {
      await ctx.reply(
        `Недостаточно средств.\n\nДоступно: *${user.balance.toLocaleString('ru-RU')} GEO*, запрошено: *${amount.toLocaleString('ru-RU')} GEO*.`,
        { parse_mode: 'Markdown', reply_markup: cancelKb() }
      );
      return true;
    }

    const card = ctx.session.withdraw.card;
    ctx.session.withdraw = null;

    const { error } = await supabase.rpc('process_withdrawal', {
      p_user_id: user.id,
      p_amount:  amount,
      p_phone:   card,
    });

    if (error) {
      const kb = new InlineKeyboard().text('« Назад', 'action:menu');
      if (error.message?.includes('INSUFFICIENT_FUNDS')) {
        return ctx.reply('Недостаточно средств на балансе.', { reply_markup: kb });
      }
      console.error('process_withdrawal error', error);
      return ctx.reply('Ошибка при создании заявки. Попробуйте позже.', { reply_markup: kb });
    }

    const geoRate = getGeoRate();
    const uzs = Math.round(amount * geoRate).toLocaleString('ru-RU');
    const network = detectNetwork(card);

    const kb = new InlineKeyboard().text('« Главное меню', 'action:menu');
    return ctx.reply(
      `✅ *Заявка принята!*\n\n` +
      `${network === 'Humo' ? '🟡' : '🔵'} Карта ${network}: \`${maskCard(card)}\`\n` +
      `Сумма: *${amount.toLocaleString('ru-RU')} GEO* (≈ ${uzs} UZS)\n\n` +
      `Выплата в течение 24 часов.`,
      { parse_mode: 'Markdown', reply_markup: kb }
    );
  }

  return false;
}

module.exports = { withdrawAction, withdrawFlow };
