const crypto = require('crypto');
const { supabase } = require('../../db/index');

function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const payload = {};

  for (const [key, value] of params.entries()) {
    payload[key] = value;
  }

  return payload;
}

function buildDataCheckString(payload) {
  return Object.keys(payload)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${payload[key]}`)
    .join('\n');
}

async function validateTma(req, res, next) {
  try {
    const initData = req.headers['initdata'] || req.headers['initData'];

    if (!initData) {
      return res.status(401).json({ error: 'MISSING_INITDATA' });
    }

    const payload = parseInitData(initData);
    const hash = payload.hash;

    if (!hash) {
      return res.status(401).json({ error: 'INVALID_INITDATA' });
    }

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN || '').digest();
    const dataCheckString = buildDataCheckString(payload);
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (expectedHash !== hash) {
      return res.status(401).json({ error: 'INVALID_SIGNATURE' });
    }

    // Reject initData older than 1 hour (replay attack prevention)
    // 5 min is for bot webhooks; Mini App sessions can last longer
    const authDate = parseInt(payload.auth_date, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!authDate || nowSec - authDate > 3600) {
      return res.status(401).json({ error: 'INITDATA_EXPIRED' });
    }

    let telegramUser = null;

    if (payload.user) {
      try {
        telegramUser = JSON.parse(payload.user);
      } catch (error) {
        telegramUser = null;
      }
    }

    if (!telegramUser || !telegramUser.id) {
      return res.status(401).json({ error: 'INVALID_USER' });
    }

    const telegramId = String(telegramUser.id);
    const username = telegramUser.username || null;
    const phone = telegramUser.phone_number || null;

    const { data: existingUser, error: selectError, status } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (selectError && status !== 406) {
      console.error('validateTma select user error', selectError);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    let user = existingUser;

    if (!user) {
      const { data: insertedUser, error: insertError } = await supabase
        .from('users')
        .insert({ telegram_id: telegramId, username, phone })
        .select('*')
        .single();

      if (insertError) {
        console.error('validateTma insert user error', insertError);
        return res.status(500).json({ error: 'INTERNAL_ERROR' });
      }

      user = insertedUser;
    }

    req.telegramUser = telegramUser;
    req.user = user;

    return next();
  } catch (error) {
    console.error('validateTma error', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

module.exports = validateTma;
