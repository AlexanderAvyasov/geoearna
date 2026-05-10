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

async function sendPhoto(telegramId, imageBuffer, caption = '') {
  const token = process.env.BOT_TOKEN;
  if (!token || !telegramId) return;

  try {
    const formData = new FormData();
    formData.append('chat_id', String(telegramId));
    formData.append('photo', new Blob([imageBuffer], { type: 'image/png' }), 'qr.png');
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'Markdown');
    }

    const resp = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('sendPhoto Telegram error', err);
    }
  } catch (err) {
    console.error('notify.sendPhoto error', err?.message);
  }
}

module.exports = { sendMessage, sendPhoto };
