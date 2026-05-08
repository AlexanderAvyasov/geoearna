async function sendMessage(telegramId, text, extra = {}) {
  const token = process.env.BOT_TOKEN;
  if (!token || !telegramId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(telegramId),
        text,
        parse_mode: 'Markdown',
        ...extra,
      }),
    });
  } catch (err) {
    console.error('notify.sendMessage error', err?.message);
  }
}

module.exports = { sendMessage };
