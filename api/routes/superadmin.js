const express = require('express');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');
const { sendMessage } = require('../services/notify');

const router = express.Router();

const SUPER_ADMIN_ID = '930826522';

function requireSuperAdmin(req, res, next) {
  if (String(req.user.telegram_id) !== SUPER_ADMIN_ID) {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }
  next();
}

const SA = [validateTma, requireSuperAdmin];

// ── Dashboard stats ──────────────────────────────────────────────────────────

router.get('/api/superadmin/stats', ...SA, async (req, res) => {
  try {
    const [
      { count: userCount },
      { count: visitCount },
      { count: bizCount },
      { count: activeCampaigns },
      { data: platform },
      { data: visits },
      { data: withdrawals },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('visits').select('*', { count: 'exact', head: true }),
      supabase.from('businesses').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('platform_wallet').select('balance').single(),
      supabase.from('visits').select('rewarded'),
      supabase.from('withdrawals').select('amount, status'),
    ]);

    const totalGeoIssued  = visits?.reduce((s, v) => s + (v.rewarded || 0), 0) || 0;
    const pendingWds      = withdrawals?.filter(w => w.status === 'pending') || [];
    const approvedGeo     = withdrawals?.filter(w => w.status === 'approved').reduce((s, w) => s + w.amount, 0) || 0;

    return res.json({
      userCount:          userCount || 0,
      visitCount:         visitCount || 0,
      bizCount:           bizCount || 0,
      activeCampaigns:    activeCampaigns || 0,
      platformBalance:    platform?.balance || 0,
      totalGeoIssued,
      pendingWithdrawals: pendingWds.length,
      pendingGeo:         pendingWds.reduce((s, w) => s + w.amount, 0),
      approvedGeo,
    });
  } catch (err) {
    console.error('superadmin/stats', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Withdrawals ──────────────────────────────────────────────────────────────

router.get('/api/superadmin/withdrawals', ...SA, async (req, res) => {
  try {
    const { status } = req.query;

    let q = supabase
      .from('withdrawals')
      .select('id, amount, phone, status, created_at, processed_at, users(telegram_id, username, balance)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (status) q = q.eq('status', status);

    const { data, error } = await q;
    if (error) throw error;

    return res.json({ withdrawals: data || [] });
  } catch (err) {
    console.error('superadmin/withdrawals GET', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/superadmin/withdrawals/:id/approve', ...SA, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const { data: wd, error: fetchErr } = await supabase
      .from('withdrawals')
      .select('id, amount, phone, status, users(telegram_id)')
      .eq('id', id)
      .single();

    if (fetchErr || !wd) return res.status(404).json({ error: 'NOT_FOUND' });
    if (wd.status !== 'pending') return res.status(400).json({ error: 'NOT_PENDING' });

    const { error } = await supabase
      .from('withdrawals')
      .update({ status: 'approved', processed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    const geoRate   = parseFloat(process.env.GEO_RATE) || 1;
    const uzsAmount = Math.round(wd.amount * geoRate);

    sendMessage(
      wd.users.telegram_id,
      `✅ *Вывод одобрен!*\n\n` +
      `💎 ${wd.amount.toLocaleString('ru-RU')} GEO → ${uzsAmount.toLocaleString('ru-RU')} UZS\n` +
      `📱 Payme: \`${wd.phone}\`\n\n` +
      `Средства отправлены на ваш Payme-кошелёк.`
    ).catch(() => {});

    return res.json({ ok: true });
  } catch (err) {
    console.error('superadmin/withdrawals approve', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/superadmin/withdrawals/:id/reject', ...SA, async (req, res) => {
  try {
    const id   = parseInt(req.params.id, 10);
    const note = req.body?.note || null;

    const { error } = await supabase.rpc('reject_withdrawal', {
      p_withdrawal_id: id,
      p_note: note,
    });

    if (error) {
      if (error.message?.includes('NOT_FOUND')) return res.status(404).json({ error: 'NOT_FOUND' });
      throw error;
    }

    const { data: wd } = await supabase
      .from('withdrawals')
      .select('amount, users(telegram_id)')
      .eq('id', id)
      .single();

    if (wd?.users?.telegram_id) {
      sendMessage(
        wd.users.telegram_id,
        `❌ *Заявка на вывод отклонена*\n\n` +
        `💎 ${wd.amount.toLocaleString('ru-RU')} GEO возвращены на ваш баланс.` +
        (note ? `\n📝 Причина: ${note}` : '') +
        `\n\nСоздайте новую заявку через приложение.`
      ).catch(() => {});
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('superadmin/withdrawals reject', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Users ────────────────────────────────────────────────────────────────────

router.get('/api/superadmin/users', ...SA, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, telegram_id, username, balance, created_at')
      .order('balance', { ascending: false })
      .limit(200);

    if (error) throw error;

    const { data: visitRows } = await supabase.from('visits').select('user_id');
    const visitMap = {};
    visitRows?.forEach(v => { visitMap[v.user_id] = (visitMap[v.user_id] || 0) + 1; });

    return res.json({
      users: (users || []).map(u => ({ ...u, visit_count: visitMap[u.id] || 0 })),
    });
  } catch (err) {
    console.error('superadmin/users', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Businesses ───────────────────────────────────────────────────────────────

router.get('/api/superadmin/businesses', ...SA, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, address, balance, owner_telegram_id, created_at, campaigns(id, active, visits_count, max_visits, budget, reward_amount)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ businesses: data || [] });
  } catch (err) {
    console.error('superadmin/businesses', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Top-up requests ──────────────────────────────────────────────────────────

router.get('/api/superadmin/topups', ...SA, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('topup_requests')
      .select('id, amount, status, note, created_at, processed_at, businesses(id, name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return res.json({ topups: data || [] });
  } catch (err) {
    console.error('superadmin/topups', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/superadmin/topups/:id/confirm', ...SA, async (req, res) => {
  try {
    const { error } = await supabase.rpc('confirm_topup', {
      p_request_id: parseInt(req.params.id, 10),
    });

    if (error) {
      if (error.message?.includes('REQUEST_NOT_FOUND')) return res.status(404).json({ error: 'NOT_FOUND' });
      throw error;
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('superadmin/topups confirm', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Campaign management ───────────────────────────────────────────────────────

router.post('/api/superadmin/campaigns/:id/toggle', ...SA, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { data: camp } = await supabase.from('campaigns').select('active').eq('id', id).single();
    if (!camp) return res.status(404).json({ error: 'NOT_FOUND' });

    const { error } = await supabase.from('campaigns').update({ active: !camp.active }).eq('id', id);
    if (error) throw error;

    return res.json({ ok: true, active: !camp.active });
  } catch (err) {
    console.error('superadmin/campaigns toggle', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
