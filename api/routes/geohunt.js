const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');

const router = express.Router();

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TG_ID;

// GET /api/geohunts/active  — public: list active hunts for home screen
router.get('/api/geohunts/active', async (_req, res) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('geohunts')
    .select('id, title, description, reward_per_code, total_codes, claimed_codes, starts_at, ends_at')
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('created_at', { ascending: false });

  if (error) { console.error('[geohunts/active]', error); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
  return res.json({ hunts: data || [] });
});

// GET /api/geohunt/info?token=  — public: get code info before claiming
router.get('/api/geohunt/info', async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== 'string' || token.length > 100) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }

  // Two-step query — avoids relying on PostgREST FK traversal (fails when FK
  // constraints are missing from the table schema).
  const { data: code, error: codeErr } = await supabase
    .from('geohunt_codes')
    .select('id, token, point_label, used_by, hunt_id')
    .eq('token', token)
    .maybeSingle();

  if (codeErr) { console.error('[geohunt/info] code', codeErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
  if (!code)   return res.status(404).json({ error: 'NOT_FOUND' });
  if (code.used_by) return res.status(410).json({ error: 'CODE_USED' });

  const { data: hunt, error: huntErr } = await supabase
    .from('geohunts')
    .select('id, title, description, reward_per_code, active, starts_at, ends_at')
    .eq('id', code.hunt_id)
    .maybeSingle();

  if (huntErr) { console.error('[geohunt/info] hunt', huntErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
  if (!hunt || !hunt.active) return res.status(410).json({ error: 'HUNT_INACTIVE' });

  const now = new Date();
  if (hunt.starts_at && new Date(hunt.starts_at) > now) return res.status(400).json({ error: 'HUNT_NOT_STARTED' });
  if (hunt.ends_at   && new Date(hunt.ends_at)   < now) return res.status(410).json({ error: 'HUNT_EXPIRED' });

  return res.json({
    codeId:     code.id,
    pointLabel: code.point_label || null,
    huntTitle:  hunt.title,
    huntDesc:   hunt.description || null,
    reward:     hunt.reward_per_code,
  });
});

// Promote initdata from query param to header so validateTma works unchanged.
// Used by GET /api/geohunt/claim to avoid CORS preflight (simple GET request).
function initDataFromQuery(req, _res, next) {
  if (!req.headers['initdata'] && req.query.initdata) {
    req.headers['initdata'] = req.query.initdata;
  }
  next();
}

// GET /api/geohunt/claim?token=&initdata=  — authenticated, no CORS preflight
router.get('/api/geohunt/claim', initDataFromQuery, validateTma, async (req, res) => {
  const { token } = req.query;
  const userId    = req.user.id;

  if (!token || typeof token !== 'string' || token.length > 100) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }

  try {
    // Ban check
    const { data: userRow } = await supabase.from('users').select('banned_at').eq('id', userId).single();
    if (userRow?.banned_at) return res.status(403).json({ error: 'USER_BANNED' });

    const { data: code, error: codeErr } = await supabase
      .from('geohunt_codes')
      .select('id, token, used_by, hunt_id')
      .eq('token', token)
      .maybeSingle();

    if (codeErr) { console.error('[geohunt/claim GET] fetch code', codeErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
    if (!code) return res.status(404).json({ error: 'NOT_FOUND' });

    const { data: hunt, error: huntErr } = await supabase
      .from('geohunts')
      .select('id, title, reward_per_code, active, starts_at, ends_at')
      .eq('id', code.hunt_id)
      .maybeSingle();

    if (huntErr) { console.error('[geohunt/claim GET] fetch hunt', huntErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
    if (!hunt || !hunt.active) return res.status(400).json({ error: 'HUNT_INACTIVE' });

    const now = new Date();
    if (hunt.starts_at && new Date(hunt.starts_at) > now) return res.status(400).json({ error: 'HUNT_NOT_STARTED' });
    if (hunt.ends_at   && new Date(hunt.ends_at)   < now) return res.status(400).json({ error: 'HUNT_EXPIRED' });

    if (code.used_by) {
      return res.status(400).json({ error: code.used_by === userId ? 'ALREADY_CLAIMED_BY_YOU' : 'CODE_USED' });
    }

    const { data: burned, error: burnErr } = await supabase
      .from('geohunt_codes')
      .update({ used_by: userId, used_at: now.toISOString() })
      .eq('id', code.id)
      .is('used_by', null)
      .select('id')
      .maybeSingle();

    if (burnErr) { console.error('[geohunt/claim GET] burn', burnErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
    if (!burned) return res.status(400).json({ error: 'CODE_USED' });

    const { error: geoErr } = await supabase.rpc('apply_checkin_bonus', {
      p_user_id: userId,
      p_amount:  hunt.reward_per_code,
    });
    if (geoErr) {
      await supabase.from('geohunt_codes').update({ used_by: null, used_at: null }).eq('id', code.id);
      console.error('[geohunt/claim GET] apply_checkin_bonus', geoErr);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    try { await supabase.rpc('increment_geohunt_claimed', { p_hunt_id: hunt.id }); } catch (_) {}

    const { data: updated } = await supabase.from('users').select('balance').eq('id', userId).single();

    return res.json({
      reward:       hunt.reward_per_code,
      totalBalance: updated?.balance || 0,
      huntTitle:    hunt.title,
    });
  } catch (e) {
    console.error('[geohunt/claim GET] unhandled', e?.message || e);
    if (!res.headersSent) res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// POST /api/geohunt/claim  — authenticated: burn code + award GEO (kept for backwards compat)
router.post('/api/geohunt/claim', validateTma, async (req, res) => {
  const { token } = req.body;
  const userId    = req.user.id;

  if (!token || typeof token !== 'string' || token.length > 100) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }

  try {
    // Ban check
    const { data: userRow } = await supabase.from('users').select('banned_at').eq('id', userId).single();
    if (userRow?.banned_at) return res.status(403).json({ error: 'USER_BANNED' });

    // Two-step fetch — avoids PostgREST FK traversal dependency
    const { data: code, error: codeErr } = await supabase
      .from('geohunt_codes')
      .select('id, token, used_by, hunt_id')
      .eq('token', token)
      .maybeSingle();

    if (codeErr) { console.error('[geohunt/claim] fetch code', codeErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
    if (!code) return res.status(404).json({ error: 'NOT_FOUND' });

    const { data: hunt, error: huntErr } = await supabase
      .from('geohunts')
      .select('id, title, reward_per_code, active, starts_at, ends_at')
      .eq('id', code.hunt_id)
      .maybeSingle();

    if (huntErr) { console.error('[geohunt/claim] fetch hunt', huntErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
    if (!hunt || !hunt.active) return res.status(400).json({ error: 'HUNT_INACTIVE' });

    const now = new Date();
    if (hunt.starts_at && new Date(hunt.starts_at) > now) return res.status(400).json({ error: 'HUNT_NOT_STARTED' });
    if (hunt.ends_at   && new Date(hunt.ends_at)   < now) return res.status(400).json({ error: 'HUNT_EXPIRED' });

    if (code.used_by) {
      return res.status(400).json({ error: code.used_by === userId ? 'ALREADY_CLAIMED_BY_YOU' : 'CODE_USED' });
    }

    // Burn code atomically — set used_by only if still null
    const { data: burned, error: burnErr } = await supabase
      .from('geohunt_codes')
      .update({ used_by: userId, used_at: now.toISOString() })
      .eq('id', code.id)
      .is('used_by', null)
      .select('id')
      .maybeSingle();

    if (burnErr) { console.error('[geohunt/claim] burn', burnErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }
    if (!burned) return res.status(400).json({ error: 'CODE_USED' });

    // Award GEO
    const { error: geoErr } = await supabase.rpc('apply_checkin_bonus', {
      p_user_id: userId,
      p_amount:  hunt.reward_per_code,
    });
    if (geoErr) {
      // Roll back the burn so the code isn't lost
      await supabase.from('geohunt_codes')
        .update({ used_by: null, used_at: null })
        .eq('id', code.id);
      console.error('[geohunt/claim] apply_checkin_bonus', geoErr);
      return res.status(500).json({ error: 'INTERNAL_ERROR' });
    }

    // Update hunt claimed_codes counter
    try { await supabase.rpc('increment_geohunt_claimed', { p_hunt_id: hunt.id }); } catch (_) {}

    const { data: updated } = await supabase.from('users').select('balance').eq('id', userId).single();

    return res.json({
      reward:       hunt.reward_per_code,
      totalBalance: updated?.balance || 0,
      huntTitle:    hunt.title,
    });
  } catch (e) {
    console.error('[geohunt/claim POST] unhandled', e?.message || e);
    if (!res.headersSent) res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── SuperAdmin: list all hunts ────────────────────────────────────────────────
router.get('/api/sa/geohunts', validateTma, async (req, res) => {
  if (String(req.user.telegram_id) !== SUPER_ADMIN_ID) return res.status(403).json({ error: 'FORBIDDEN' });
  const { data, error } = await supabase
    .from('geohunts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  return res.json({ hunts: data || [] });
});

// ── SuperAdmin: create hunt + bulk-generate codes ─────────────────────────────
router.post('/api/sa/geohunts', validateTma, async (req, res) => {
  if (String(req.user.telegram_id) !== SUPER_ADMIN_ID) return res.status(403).json({ error: 'FORBIDDEN' });
  const { title, description, reward_per_code, starts_at, ends_at, code_count } = req.body;
  if (!title || !reward_per_code || !code_count || code_count < 1 || code_count > 500) {
    return res.status(400).json({ error: 'INVALID_PARAMS' });
  }

  // Create hunt
  const { data: hunt, error: huntErr } = await supabase.from('geohunts').insert({
    title, description: description || null,
    reward_per_code,
    starts_at: starts_at || null,
    ends_at: ends_at || null,
    total_codes: code_count,
  }).select().single();
  if (huntErr) { console.error('[sa/geohunts] create', huntErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }

  // Bulk insert codes (DB generates tokens via DEFAULT)
  const rows = Array.from({ length: code_count }, () => ({ hunt_id: hunt.id }));
  const { data: codes, error: codesErr } = await supabase
    .from('geohunt_codes')
    .insert(rows)
    .select('id, token');
  if (codesErr) { console.error('[sa/geohunts] codes', codesErr); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }

  return res.status(201).json({ hunt, codes });
});

// ── SuperAdmin: send all QR images to SA's Telegram ────────────────────────
router.post('/api/sa/geohunts/:id/send-qr', validateTma, async (req, res) => {
  if (String(req.user.telegram_id) !== SUPER_ADMIN_ID) return res.status(403).json({ error: 'FORBIDDEN' });

  const { id } = req.params;
  const webappUrl = process.env.WEBAPP_URL || '';

  const { data: hunt } = await supabase.from('geohunts').select('title').eq('id', id).single();
  if (!hunt) return res.status(404).json({ error: 'NOT_FOUND' });

  const { data: codes } = await supabase
    .from('geohunt_codes')
    .select('id, token, point_label')
    .eq('hunt_id', id)
    .order('created_at', { ascending: true });

  if (!codes || codes.length === 0) return res.status(400).json({ error: 'NO_CODES' });

  // Respond immediately so the client doesn't wait
  res.json({ ok: true, total: codes.length });

  // Background: send text summary + individual QR images
  const QRCode        = require('qrcode');
  const { sendPhoto, sendMessage } = require('../services/notify');

  const urlList = codes.map((c, i) => {
    const url   = `${webappUrl}/checkin?token=${c.token}&geohunt=1`;
    const label = c.point_label || `Код ${i + 1}`;
    return `📍 *${label}*\n\`${url}\``;
  }).join('\n\n');

  await sendMessage(SUPER_ADMIN_ID,
    `🗺 *GeoHunt: "${hunt.title}"*\nВсего точек: ${codes.length}\n\n${urlList}`,
  ).catch(() => {});

  for (let i = 0; i < codes.length; i++) {
    const code  = codes[i];
    const url   = `${webappUrl}/checkin?token=${code.token}&geohunt=1`;
    const label = code.point_label || `Код ${i + 1}`;
    try {
      const buf = await QRCode.toBuffer(url, { width: 600, margin: 3 });
      await sendPhoto(SUPER_ADMIN_ID, buf, `*${label}*`);
    } catch (e) {
      console.error('[sa/geohunts/send-qr]', e.message);
    }
    // Small pause every 10 photos to avoid Telegram rate limits
    if (i > 0 && i % 10 === 0) await new Promise(r => setTimeout(r, 800));
  }
});

// ── SuperAdmin: toggle hunt active ──────────────────────────────────────────
router.patch('/api/sa/geohunts/:id', validateTma, async (req, res) => {
  if (String(req.user.telegram_id) !== SUPER_ADMIN_ID) return res.status(403).json({ error: 'FORBIDDEN' });
  const { active } = req.body;
  const { data, error } = await supabase.from('geohunts')
    .update({ active })
    .eq('id', req.params.id)
    .select().single();
  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  return res.json(data);
});

// ── SuperAdmin: get codes for a hunt ────────────────────────────────────────
router.get('/api/sa/geohunts/:id/codes', validateTma, async (req, res) => {
  if (String(req.user.telegram_id) !== SUPER_ADMIN_ID) return res.status(403).json({ error: 'FORBIDDEN' });
  const { data, error } = await supabase
    .from('geohunt_codes')
    .select('id, token, point_label, used_by, used_at, created_at')
    .eq('hunt_id', req.params.id)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  return res.json({ codes: data || [] });
});

module.exports = router;
