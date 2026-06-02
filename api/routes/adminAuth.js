const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();

router.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const expected = process.env.ADMIN_WEB_PASSWORD;

  if (!expected) return res.status(503).json({ error: 'AUTH_NOT_CONFIGURED' });

  const a = Buffer.from(String(password || ''));
  const b = Buffer.from(expected);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) return res.status(401).json({ error: 'INVALID_PASSWORD' });

  const secret  = process.env.ADMIN_JWT_SECRET || expected;
  const payload = `${Date.now()}:webadmin`;
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token   = `${Buffer.from(payload).toString('base64')}.${sig}`;

  return res.json({ token });
});

module.exports = router;
