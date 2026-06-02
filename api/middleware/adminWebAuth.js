const crypto = require('crypto');

function validateAdminToken(token) {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.ADMIN_WEB_PASSWORD;
  if (!secret) return false;
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return false;
    const payloadB64 = token.slice(0, dot);
    const sig        = token.slice(dot + 1);
    const payload    = Buffer.from(payloadB64, 'base64').toString('utf8');
    const [tsStr]    = payload.split(':');
    const age        = Date.now() - Number(tsStr);
    if (!Number.isFinite(age) || age < 0 || age > 30 * 86400_000) return false;
    const expected    = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const expBuf      = Buffer.from(expected, 'hex');
    const sigBuf      = Buffer.from(sig,      'hex');
    if (expBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expBuf, sigBuf);
  } catch { return false; }
}

module.exports = function adminWebAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const token = auth.slice(7);
  if (!validateAdminToken(token)) return res.status(401).json({ error: 'INVALID_TOKEN' });
  req.user = {
    telegram_id: process.env.SUPER_ADMIN_TG_ID,
    id: null,
    _isWebAdmin: true,
  };
  next();
};
