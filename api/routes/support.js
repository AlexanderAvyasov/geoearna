const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');
const { sendMessage } = require('../services/notify');

const router = express.Router();

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TG_ID || '930826522';

// POST /api/support — authenticated user submits a support message
router.post('/api/support', validateTma, async (req, res) => {
  try {
    const { type = 'chat', message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length < 3) {
      return res.status(400).json({ error: 'MESSAGE_TOO_SHORT' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'MESSAGE_TOO_LONG' });
    }

    const msgType = ['chat', 'report'].includes(type) ? type : 'chat';

    const { data: userData } = await supabase
      .from('users')
      .select('id, username, telegram_id')
      .eq('telegram_id', req.user.telegram_id)
      .single();

    if (!userData) return res.status(404).json({ error: 'USER_NOT_FOUND' });

    const { data: msg, error } = await supabase
      .from('support_messages')
      .insert({ user_id: userData.id, type: msgType, message: message.trim(), status: 'open' })
      .select('id')
      .single();

    if (error) throw error;

    // Notify super admin
    const typeLabel = msgType === 'report' ? '🚨 Жалоба' : '💬 Обращение';
    const userName  = userData.username ? `@${userData.username}` : `ID ${userData.telegram_id}`;
    await sendMessage(
      SUPER_ADMIN_ID,
      `${typeLabel} #${msg.id}\n\nОт: ${userName}\n\n${message.trim()}`
    ).catch(() => {});

    return res.json({ ok: true, id: msg.id });
  } catch (e) {
    console.error('POST /api/support error', e.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
