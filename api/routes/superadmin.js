const express = require('express');
const crypto = require('crypto');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');
const { sendMessage } = require('../services/notify');
const { getGeoRate } = require('../lib/geoRate');

const router = express.Router();

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TG_ID || '930826522';

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
      { data: geoIssuedRow },
      { data: withdrawals },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('visits').select('*', { count: 'exact', head: true }),
      supabase.from('businesses').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('platform_wallet').select('balance').single(),
      // Use DB-level aggregate instead of fetching all rows
      supabase.from('visits').select('rewarded.sum()').single(),
      supabase.from('withdrawals').select('amount, status').limit(2000),
    ]);

    const totalGeoIssued  = geoIssuedRow?.rewarded || 0;
    const pendingWds      = (withdrawals || []).filter(w => w.status === 'pending');
    const approvedGeo     = (withdrawals || []).filter(w => w.status === 'approved').reduce((s, w) => s + w.amount, 0);

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
      .select('id, amount, phone, status, note, created_at, processed_at, users!user_id(telegram_id, username, balance)')
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

    // Атомично: одобряем вывод + списываем из platform_wallet
    const { error } = await supabase.rpc('approve_withdrawal', { p_withdrawal_id: id });

    if (error) {
      if (error.message?.includes('NOT_FOUND')) return res.status(404).json({ error: 'NOT_FOUND' });
      throw error;
    }

    const geoRate   = getGeoRate();
    const uzsAmount = Math.round(wd.amount * geoRate);

    const maskedCard = wd.phone ? `**** **** **** ${String(wd.phone).slice(-4)}` : '—';
    sendMessage(
      wd.users.telegram_id,
      `✅ *Вывод одобрен!*\n\n` +
      `💎 ${wd.amount.toLocaleString('ru-RU')} GEO → ${uzsAmount.toLocaleString('ru-RU')} UZS\n` +
      `💳 Карта: \`${maskedCard}\`\n\n` +
      `Средства отправлены на вашу карту.`
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

    // Fetch visit counts only for the users we already have (avoids full-table scan)
    const userIds = (users || []).map(u => u.id);
    const visitMap = {};
    if (userIds.length > 0) {
      const { data: visitRows } = await supabase
        .from('visits')
        .select('user_id')
        .in('user_id', userIds);
      visitRows?.forEach(v => { visitMap[v.user_id] = (visitMap[v.user_id] || 0) + 1; });
    }

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

// Edit any campaign field (superadmin)
router.patch('/api/superadmin/campaigns/:id', ...SA, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reward_amount, max_visits, ends_at, active } = req.body;

    const updates = {};
    if (reward_amount !== undefined && Number.isInteger(reward_amount) && reward_amount >= 1) updates.reward_amount = reward_amount;
    if (max_visits !== undefined && Number.isInteger(max_visits) && max_visits >= 1) updates.max_visits = max_visits;
    if (ends_at !== undefined) updates.ends_at = ends_at || null;
    if (active !== undefined) updates.active = !!active;

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'NOTHING_TO_UPDATE' });

    const { error } = await supabase.from('campaigns').update(updates).eq('id', id);
    if (error) throw error;

    try { await supabase.from('sa_audit_log').insert({ action: 'campaign_edit', target_id: id, admin_id: Number(SUPER_ADMIN_ID), note: JSON.stringify(updates) }); } catch (_) {}

    return res.json({ ok: true });
  } catch (err) {
    console.error('superadmin/campaigns PATCH', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// Create platform promo campaign — platform wallet funds it, business hosts it
router.post('/api/superadmin/platform-campaign', ...SA, async (req, res) => {
  try {
    const { business_id, reward_amount, max_visits, ends_at, task_type, task_description } = req.body;

    if (!Number.isInteger(business_id) || business_id < 1) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'business_id required' });
    }
    if (!Number.isInteger(reward_amount) || reward_amount < 1) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'reward_amount must be >= 1' });
    }
    if (!Number.isInteger(max_visits) || max_visits < 1 || max_visits > 100000) {
      return res.status(400).json({ error: 'INVALID_PARAMS', message: 'max_visits must be 1–100000' });
    }

    const totalCost = reward_amount * max_visits;

    const { data: wallet } = await supabase.from('platform_wallet').select('balance').single();
    if (!wallet || wallet.balance < totalCost) {
      return res.status(400).json({ error: 'INSUFFICIENT_PLATFORM_BALANCE', available: wallet?.balance || 0 });
    }

    const { data: business } = await supabase
      .from('businesses').select('id, name, qr_token, balance').eq('id', business_id).single();
    if (!business) return res.status(404).json({ error: 'BUSINESS_NOT_FOUND' });

    // Deduct from platform wallet (optimistic: only if balance still sufficient)
    const { count: walletUpdated } = await supabase
      .from('platform_wallet')
      .update({ balance: wallet.balance - totalCost }, { count: 'exact' })
      .gte('balance', totalCost);
    if (!walletUpdated) return res.status(400).json({ error: 'INSUFFICIENT_PLATFORM_BALANCE' });

    // Credit business so checkin flow can deduct normally
    await supabase
      .from('businesses')
      .update({ balance: business.balance + totalCost })
      .eq('id', business_id);

    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .insert({
        business_id,
        budget:           totalCost,
        reward_amount,
        max_visits,
        task_type:        task_type || 'visit',
        task_description: task_description || null,
        active:           true,
        requires_pin:     false,
        ends_at:          ends_at || null,
      })
      .select()
      .single();

    if (campErr) throw campErr;

    const webappUrl = process.env.WEBAPP_URL || '';
    const qrUrl = `${webappUrl}/checkin?token=${business.qr_token}&cid=${campaign.id}`;

    try { await supabase.from('sa_audit_log').insert({ action: 'platform_campaign_create', target_id: campaign.id, admin_id: Number(SUPER_ADMIN_ID), note: `${reward_amount} GEO x ${max_visits} = ${totalCost} for biz ${business_id}` }); } catch (_) {}

    return res.json({ campaign, qrUrl, business: { id: business.id, name: business.name, qr_token: business.qr_token } });
  } catch (err) {
    console.error('superadmin/platform-campaign', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

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

// ── Enhanced overview (God View) ──────────────────────────────────────────────

router.get('/api/superadmin/overview', ...SA, async (req, res) => {
  try {
    const now = new Date();
    const todayMs        = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayStart     = new Date(todayMs).toISOString();
    const yesterdayStart = new Date(todayMs - 86400_000).toISOString();
    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonStart   = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const [
      { data: todayViz },
      { data: ydayViz },
      { data: monthViz },
      { data: lastMonViz },
      { count: checkinsToday },
      { count: pendingCount },
      { data: pendingAmts },
      { data: platform },
      { count: totalBiz },
      { count: bizZero },
      { count: activeCamps },
      { data: geoIssuedRow },
      { data: approvedWds },
    ] = await Promise.all([
      supabase.from('visits').select('user_id, business_id').gte('created_at', todayStart).limit(5000),
      supabase.from('visits').select('user_id').gte('created_at', yesterdayStart).lt('created_at', todayStart).limit(5000),
      supabase.from('visits').select('user_id').gte('created_at', monthStart).limit(10000),
      supabase.from('visits').select('user_id').gte('created_at', lastMonStart).lt('created_at', monthStart).limit(10000),
      supabase.from('visits').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('withdrawals').select('amount').eq('status', 'pending'),
      supabase.from('platform_wallet').select('balance').single(),
      supabase.from('businesses').select('*', { count: 'exact', head: true }),
      supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('balance', 0),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('active', true),
      supabase.from('visits').select('rewarded.sum()').single(),
      supabase.from('withdrawals').select('amount').eq('status', 'approved').limit(5000),
    ]);

    const dau     = new Set((todayViz   || []).map(v => v.user_id)).size;
    const dauPrev = new Set((ydayViz    || []).map(v => v.user_id)).size;
    const mau     = new Set((monthViz   || []).map(v => v.user_id)).size;
    const mauPrev = new Set((lastMonViz || []).map(v => v.user_id)).size;
    const dauTrend = dauPrev > 0 ? Math.round((dau - dauPrev) / dauPrev * 100) : null;
    const mauTrend = mauPrev > 0 ? Math.round((mau - mauPrev) / mauPrev * 100) : null;

    const bizPerUser = {};
    (todayViz || []).forEach(v => {
      if (!bizPerUser[v.user_id]) bizPerUser[v.user_id] = new Set();
      bizPerUser[v.user_id].add(v.business_id);
    });
    const fraudSuspectsCount = Object.values(bizPerUser).filter(s => s.size > 3).length;
    const pendingGeo     = (pendingAmts  || []).reduce((s, w) => s + (w.amount || 0), 0);
    const totalGeoIssued = geoIssuedRow?.rewarded || 0;
    const approvedGeo    = (approvedWds  || []).reduce((s, w) => s + (w.amount || 0), 0);

    return res.json({
      dau, dauTrend,
      mau, mauTrend,
      checkinsToday:      checkinsToday || 0,
      pendingWithdrawals: pendingCount  || 0,
      pendingGeo,
      platformBalance:    platform?.balance || 0,
      totalBiz:           totalBiz || 0,
      bizZeroBalance:     bizZero  || 0,
      activeCamps:        activeCamps || 0,
      fraudSuspectsCount,
      geoRate:            getGeoRate(),
      totalGeoIssued,
      approvedGeo,
    });
  } catch (err) {
    console.error('superadmin/overview', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Fraud suspects ────────────────────────────────────────────────────────────

router.get('/api/superadmin/fraud', ...SA, async (req, res) => {
  try {
    const h24 = new Date(Date.now() - 86400_000).toISOString();

    const { data: recentVisits, error } = await supabase
      .from('visits')
      .select('user_id, business_id, created_at, rewarded, users(id, telegram_id, username)')
      .gte('created_at', h24)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const userMap = {};
    (recentVisits || []).forEach(v => {
      const uid = v.user_id;
      if (!userMap[uid]) {
        userMap[uid] = {
          user_id:     uid,
          db_id:       v.users?.id,
          telegram_id: v.users?.telegram_id,
          username:    v.users?.username,
          visits:      [],
          bizSet:      new Set(),
          totalGeo:    0,
        };
      }
      userMap[uid].visits.push({ created_at: v.created_at, business_id: v.business_id });
      userMap[uid].bizSet.add(v.business_id);
      userMap[uid].totalGeo += v.rewarded || 0;
    });

    const suspects = Object.values(userMap)
      .map(u => ({
        user_id:      u.user_id,
        db_id:        u.db_id,
        telegram_id:  u.telegram_id,
        username:     u.username,
        visitCount24h:  u.visits.length,
        distinctBiz24h: u.bizSet.size,
        totalGeo24h:    u.totalGeo,
        lastVisit:      u.visits[0]?.created_at,
        flag: u.bizSet.size > 4 || u.visits.length > 8 ? 'HIGH'
            : u.bizSet.size > 2 || u.visits.length > 4 ? 'MEDIUM'
            : null,
      }))
      .filter(u => u.flag !== null)
      .sort((a, b) => b.visitCount24h - a.visitCount24h)
      .slice(0, 50);

    return res.json({ suspects });
  } catch (err) {
    console.error('superadmin/fraud', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── All campaigns ─────────────────────────────────────────────────────────────

router.get('/api/superadmin/campaigns', ...SA, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, active, budget, reward_amount, visits_count, max_visits, task_type, requires_pin, ends_at, businesses!business_id(id, name, owner_telegram_id)')
      .order('id', { ascending: false })
      .limit(300);

    if (error) throw error;

    const campaigns = (data || []).map(c => ({
      ...c,
      business_name:        c.businesses?.name,
      business_id:          c.businesses?.id,
      owner_telegram_id:    c.businesses?.owner_telegram_id,
      fillRate:             c.max_visits > 0 ? Math.round(c.visits_count / c.max_visits * 100) : 0,
      isAnomaly:            c.reward_amount > 5000,
      businesses:           undefined,
    }));

    return res.json({ campaigns });
  } catch (err) {
    console.error('superadmin/campaigns', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── User detail card ──────────────────────────────────────────────────────────

router.get('/api/superadmin/users/:id/card', ...SA, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: 'INVALID_PARAMS' });

    const [{ data: userRow }, { data: visits }, { data: wds }] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('visits').select('id, rewarded, created_at, businesses(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      supabase.from('withdrawals').select('id, amount, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    ]);

    if (!userRow) return res.status(404).json({ error: 'NOT_FOUND' });

    return res.json({
      user:               userRow,
      recentVisits:       (visits || []).map(v => ({ ...v, business_name: v.businesses?.name, businesses: undefined })),
      recentWithdrawals:  wds || [],
    });
  } catch (err) {
    console.error('superadmin/users/:id/card', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── User ban ──────────────────────────────────────────────────────────────────

router.post('/api/superadmin/users/:id/ban', ...SA, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    if (!userId) return res.status(400).json({ error: 'INVALID_PARAMS' });

    const { data: userRow } = await supabase.from('users').select('telegram_id').eq('id', userId).single();

    const { error } = await supabase.from('users').update({ banned_at: new Date().toISOString() }).eq('id', userId);
    if (error) { console.error('user ban error', error); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }

    if (userRow?.telegram_id) {
      sendMessage(userRow.telegram_id, `⛔ *Ваш аккаунт заблокирован*${reason ? `\n\nПричина: ${reason}` : ''}`).catch(() => {});
    }

    try { await supabase.from('sa_audit_log').insert({ action: 'user_ban', target_id: userId, admin_id: Number(SUPER_ADMIN_ID), note: reason || null }); } catch (_) {}

    return res.json({ ok: true });
  } catch (err) {
    console.error('superadmin/users/:id/ban', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── User unban ────────────────────────────────────────────────────────────────

router.post('/api/superadmin/users/:id/unban', ...SA, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (!userId) return res.status(400).json({ error: 'INVALID_PARAMS' });

    const { error } = await supabase.from('users').update({ banned_at: null }).eq('id', userId);
    if (error) { console.error('user unban error', error); return res.status(500).json({ error: 'INTERNAL_ERROR' }); }

    try { await supabase.from('sa_audit_log').insert({ action: 'user_unban', target_id: userId, admin_id: Number(SUPER_ADMIN_ID) }); } catch (_) {}

    return res.json({ ok: true });
  } catch (err) {
    console.error('superadmin/users/:id/unban', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Manual GEO adjustment ─────────────────────────────────────────────────────

router.post('/api/superadmin/users/:id/adjust', ...SA, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { amount, note } = req.body;
    if (!userId || typeof amount !== 'number') return res.status(400).json({ error: 'INVALID_PARAMS' });
    if (!note?.trim()) return res.status(400).json({ error: 'NOTE_REQUIRED' });

    const { data: userRow } = await supabase.from('users').select('balance').eq('id', userId).single();
    if (!userRow) return res.status(404).json({ error: 'NOT_FOUND' });

    const newBalance = Math.round(Math.max(0, userRow.balance + amount));
    const { error } = await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', detail: error.message });

    try {
      await supabase.from('sa_audit_log').insert({
        action: amount >= 0 ? 'geo_credit' : 'geo_debit',
        target_id: userId, admin_id: Number(SUPER_ADMIN_ID),
        note: `${amount >= 0 ? '+' : ''}${amount} GEO: ${note}`,
      });
    } catch (_) {}

    return res.json({ ok: true, newBalance });
  } catch (err) {
    console.error('superadmin/users/:id/adjust', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Business suspend / unsuspend ──────────────────────────────────────────────

router.post('/api/superadmin/businesses/:id/suspend', ...SA, async (req, res) => {
  try {
    const bizId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    if (!bizId) return res.status(400).json({ error: 'INVALID_PARAMS' });

    await supabase.from('campaigns').update({ active: false }).eq('business_id', bizId);

    const { error } = await supabase.from('businesses').update({ suspended_at: new Date().toISOString() }).eq('id', bizId);
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', detail: error.message });

    try { await supabase.from('sa_audit_log').insert({ action: 'business_suspend', target_id: bizId, admin_id: Number(SUPER_ADMIN_ID), note: reason || null }); } catch (_) {}

    return res.json({ ok: true });
  } catch (err) {
    console.error('superadmin/businesses/:id/suspend', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/superadmin/businesses/:id/unsuspend', ...SA, async (req, res) => {
  try {
    const bizId = parseInt(req.params.id, 10);
    if (!bizId) return res.status(400).json({ error: 'INVALID_PARAMS' });

    const { error } = await supabase.from('businesses').update({ suspended_at: null }).eq('id', bizId);
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR', detail: error.message });

    try { await supabase.from('sa_audit_log').insert({ action: 'business_unsuspend', target_id: bizId, admin_id: Number(SUPER_ADMIN_ID) }); } catch (_) {}

    return res.json({ ok: true });
  } catch (err) {
    console.error('superadmin/businesses/:id/unsuspend', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Platform config & GEO rate ────────────────────────────────────────────────

router.get('/api/superadmin/platform-config', ...SA, async (req, res) => {
  try {
    let rateHistory = null;
    try {
      const { data } = await supabase
        .from('geo_rate_history')
        .select('rate, admin_id, note, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      rateHistory = data;
    } catch (_) {}

    return res.json({
      geoRate:     getGeoRate(),
      rateHistory: rateHistory || [],
      topupCard:   process.env.TOPUP_CARD_NUMBER || null,
      topupBank:   process.env.TOPUP_BANK || null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/superadmin/config/rate', ...SA, async (req, res) => {
  try {
    const { rate, note } = req.body;
    if (!Number.isFinite(rate) || rate <= 0) return res.status(400).json({ error: 'INVALID_PARAMS' });

    const { error } = await supabase.from('geo_rate_history').insert({
      rate, admin_id: Number(SUPER_ADMIN_ID), note: note || null,
    });

    try {
      await supabase.from('sa_audit_log').insert({
        action: 'rate_change', admin_id: Number(SUPER_ADMIN_ID),
        note: `Курс → ${rate} UZS/GEO${note ? ': ' + note : ''}`,
      });
    } catch (_) {}

    if (error) {
      return res.json({ ok: true, warning: 'geo_rate_history table missing — update GEO_RATE in Railway env vars', currentEnvRate: getGeoRate() });
    }

    return res.json({ ok: true, rate });
  } catch (err) {
    console.error('superadmin/config/rate', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Unit economics ────────────────────────────────────────────────────────────

router.get('/api/superadmin/economics', ...SA, async (req, res) => {
  try {
    const [{ data: topups }, { data: withdrawals }, { data: platform }, { data: visits }] = await Promise.all([
      supabase.from('topup_requests').select('amount, created_at').eq('status', 'confirmed'),
      supabase.from('withdrawals').select('amount, status, created_at'),
      supabase.from('platform_wallet').select('balance').single(),
      supabase.from('visits').select('rewarded, created_at'),
    ]);

    const geoRate      = getGeoRate();
    // amount stores netGeo — multiply by geoRate to get UZS revenue
    const totalRevenue = Math.round((topups || []).reduce((s, t) => s + (t.amount || 0), 0) * geoRate);
    const totalIssued  = (visits       || []).reduce((s, v) => s + (v.rewarded || 0), 0);
    const approvedGeo  = (withdrawals  || []).filter(w => w.status === 'approved').reduce((s, w) => s + (w.amount || 0), 0);
    const pendingGeo   = (withdrawals  || []).filter(w => w.status === 'pending').reduce((s, w) => s + (w.amount || 0), 0);
    const totalPayout  = Math.round(approvedGeo * geoRate);
    const margin       = totalRevenue - totalPayout;

    const now = new Date();
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const ds = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const de = new Date(ds.getTime() + 86400_000);
      const rev = Math.round((topups || []).filter(t => new Date(t.created_at) >= ds && new Date(t.created_at) < de).reduce((s, t) => s + t.amount, 0) * geoRate);
      const pay = (withdrawals || []).filter(w => w.status === 'approved' && new Date(w.created_at) >= ds && new Date(w.created_at) < de).reduce((s, w) => s + w.amount, 0);
      daily.push({ date: ds.toISOString().slice(0, 10), revenue: rev, payout: Math.round(pay * geoRate) });
    }

    return res.json({ totalRevenue, totalPayout, totalIssued, approvedGeo, pendingGeo, platformBalance: platform?.balance || 0, margin, geoRate, daily });
  } catch (err) {
    console.error('superadmin/economics', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Promo QR Campaigns ────────────────────────────────────────────────────────

const VALID_RARITIES = ['common', 'rare', 'epic', 'legendary'];

router.get('/api/superadmin/promo-campaigns', ...SA, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('promo_campaigns')
      .select('id, token, title, description, reward_amount, max_claims, claims_count, rarity, lat, lng, radius_m, expires_at, cooldown_hours, image_url, active, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const webappUrl = process.env.WEBAPP_URL || '';
    const now = new Date();
    const campaigns = (data || []).map(c => ({
      ...c,
      qrUrl:       `${webappUrl}/checkin?token=${c.token}&promo=1`,
      remaining:   c.max_claims - c.claims_count,
      isExpired:   c.expires_at ? new Date(c.expires_at) <= now : false,
      isExhausted: c.claims_count >= c.max_claims,
      totalGeo:    c.claims_count * c.reward_amount,
    }));

    return res.json({ campaigns });
  } catch (err) {
    console.error('superadmin/promo-campaigns GET', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/superadmin/promo-campaigns', ...SA, async (req, res) => {
  try {
    const { title, description, reward_amount, max_claims, rarity, lat, lng, radius_m, expires_at, cooldown_hours, image_url } = req.body;

    if (!title?.trim())                                             return res.status(400).json({ error: 'INVALID_PARAMS', message: 'title required' });
    if (!Number.isFinite(lat) || !Number.isFinite(lng))            return res.status(400).json({ error: 'INVALID_PARAMS', message: 'lat/lng required' });
    if (!Number.isInteger(reward_amount) || reward_amount < 1)     return res.status(400).json({ error: 'INVALID_PARAMS', message: 'reward_amount >= 1' });
    if (!Number.isInteger(max_claims)    || max_claims    < 1)     return res.status(400).json({ error: 'INVALID_PARAMS', message: 'max_claims >= 1' });
    if (!VALID_RARITIES.includes(rarity))                          return res.status(400).json({ error: 'INVALID_PARAMS', message: 'invalid rarity' });

    const token = 'promo_' + crypto.randomBytes(24).toString('hex');

    const { data: campaign, error } = await supabase
      .from('promo_campaigns')
      .insert({
        token,
        title:          title.trim(),
        description:    description?.trim() || null,
        reward_amount,
        max_claims,
        rarity,
        lat,
        lng,
        radius_m:       Number.isInteger(radius_m) && radius_m > 0 ? radius_m : 200,
        expires_at:     expires_at || null,
        cooldown_hours: Number.isInteger(cooldown_hours) && cooldown_hours >= 0 ? cooldown_hours : 0,
        image_url:      image_url?.trim() || null,
        created_by:     Number(SUPER_ADMIN_ID),
      })
      .select()
      .single();

    if (error) throw error;

    const webappUrl = process.env.WEBAPP_URL || '';
    const qrUrl = `${webappUrl}/checkin?token=${token}&promo=1`;

    try {
      await supabase.from('sa_audit_log').insert({
        action: 'promo_campaign_create', target_id: campaign.id, admin_id: Number(SUPER_ADMIN_ID),
        note: `${rarity} · ${reward_amount} GEO · ${max_claims} claims · "${title}"`,
      });
    } catch (_) {}

    return res.json({ campaign, qrUrl });
  } catch (err) {
    console.error('superadmin/promo-campaigns POST', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR', detail: err.message });
  }
});

router.patch('/api/superadmin/promo-campaigns/:id', ...SA, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { active, expires_at, max_claims, title, description } = req.body;

    const updates = {};
    if (active      !== undefined)                                      updates.active      = !!active;
    if (expires_at  !== undefined)                                      updates.expires_at  = expires_at || null;
    if (title       !== undefined && title?.trim())                     updates.title       = title.trim();
    if (description !== undefined)                                      updates.description = description?.trim() || null;
    if (max_claims  !== undefined && Number.isInteger(max_claims) && max_claims >= 1) updates.max_claims = max_claims;

    if (!Object.keys(updates).length) return res.status(400).json({ error: 'NOTHING_TO_UPDATE' });

    const { error } = await supabase.from('promo_campaigns').update(updates).eq('id', id);
    if (error) throw error;

    return res.json({ ok: true });
  } catch (err) {
    console.error('superadmin/promo-campaigns PATCH', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.delete('/api/superadmin/promo-campaigns/:id', ...SA, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { error } = await supabase.from('promo_campaigns').delete().eq('id', id);
    if (error) throw error;
    try { await supabase.from('sa_audit_log').insert({ action: 'promo_campaign_delete', target_id: id, admin_id: Number(SUPER_ADMIN_ID) }); } catch (_) {}
    return res.json({ ok: true });
  } catch (err) {
    console.error('superadmin/promo-campaigns DELETE', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/api/superadmin/promo-campaigns/:id/analytics', ...SA, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const [{ data: promo }, { data: claims }] = await Promise.all([
      supabase.from('promo_campaigns').select('*').eq('id', id).single(),
      supabase.from('promo_claims')
        .select('claimed_at, geo_awarded, user_id, users(telegram_id, username)')
        .eq('promo_id', id)
        .order('claimed_at', { ascending: false })
        .limit(100),
    ]);

    if (!promo) return res.status(404).json({ error: 'NOT_FOUND' });

    const totalGeo    = (claims || []).reduce((s, c) => s + c.geo_awarded, 0);
    const uniqueUsers = new Set((claims || []).map(c => c.user_id)).size;

    const webappUrl = process.env.WEBAPP_URL || '';
    return res.json({
      promo: { ...promo, qrUrl: `${webappUrl}/checkin?token=${promo.token}&promo=1` },
      claims: (claims || []).map(c => ({
        claimed_at: c.claimed_at,
        geo_awarded: c.geo_awarded,
        username: c.users?.username || null,
        telegram_id: c.users?.telegram_id || null,
      })),
      totalGeo,
      uniqueUsers,
    });
  } catch (err) {
    console.error('superadmin/promo-campaigns analytics', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Audit log ─────────────────────────────────────────────────────────────────

router.get('/api/superadmin/audit-log', ...SA, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sa_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return res.json({ log: [], warning: 'sa_audit_log table not yet created' });
    return res.json({ log: data || [] });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Gamification: task definitions CRUD ──────────────────────────────────────

router.get('/api/superadmin/tasks', ...SA, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('task_definitions').select('*').order('type').order('key');
    if (error) throw error;
    return res.json({ tasks: data || [] });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/superadmin/tasks', ...SA, async (req, res) => {
  try {
    const { key, type, title, geo_reward, xp_reward, requirement } = req.body;
    if (!key || !type || !title) return res.status(400).json({ error: 'INVALID_PARAMS' });
    if (!['daily', 'weekly', 'onetime'].includes(type)) return res.status(400).json({ error: 'INVALID_TYPE' });
    const { data, error } = await supabase.from('task_definitions').insert({
      key: key.trim(),
      type,
      title: title.trim(),
      geo_reward: Number(geo_reward) || 0,
      xp_reward: Number(xp_reward) || 0,
      requirement: requirement || {},
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ task: data });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.patch('/api/superadmin/tasks/:key', ...SA, async (req, res) => {
  try {
    const { key } = req.params;
    const { title, geo_reward, xp_reward } = req.body;
    const updates = {};
    if (title !== undefined)      updates.title      = title;
    if (geo_reward !== undefined) updates.geo_reward = Number(geo_reward);
    if (xp_reward !== undefined)  updates.xp_reward  = Number(xp_reward);
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'NOTHING_TO_UPDATE' });
    const { error } = await supabase.from('task_definitions').update(updates).eq('key', key);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.delete('/api/superadmin/tasks/:key', ...SA, async (req, res) => {
  try {
    const { key } = req.params;
    await supabase.from('user_tasks').delete().eq('task_key', key);
    const { error } = await supabase.from('task_definitions').delete().eq('key', key);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Gamification: achievement definitions CRUD ────────────────────────────────

router.get('/api/superadmin/achievements', ...SA, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('achievement_definitions').select('*').order('key');
    if (error) throw error;
    return res.json({ achievements: data || [] });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/superadmin/achievements', ...SA, async (req, res) => {
  try {
    const { key, title, description, geo_reward, xp_reward, requirement } = req.body;
    if (!key || !title || !description) return res.status(400).json({ error: 'INVALID_PARAMS' });
    const { data, error } = await supabase.from('achievement_definitions').insert({
      key: key.trim(),
      title: title.trim(),
      description: description.trim(),
      geo_reward: Number(geo_reward) || 0,
      xp_reward: Number(xp_reward) || 0,
      requirement: requirement || {},
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ achievement: data });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.patch('/api/superadmin/achievements/:key', ...SA, async (req, res) => {
  try {
    const { key } = req.params;
    const { title, description, geo_reward, xp_reward } = req.body;
    const updates = {};
    if (title !== undefined)       updates.title       = title;
    if (description !== undefined) updates.description = description;
    if (geo_reward !== undefined)  updates.geo_reward  = Number(geo_reward);
    if (xp_reward !== undefined)   updates.xp_reward   = Number(xp_reward);
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'NOTHING_TO_UPDATE' });
    const { error } = await supabase.from('achievement_definitions').update(updates).eq('key', key);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.delete('/api/superadmin/achievements/:key', ...SA, async (req, res) => {
  try {
    const { key } = req.params;
    await supabase.from('user_achievements').delete().eq('achievement_key', key);
    const { error } = await supabase.from('achievement_definitions').delete().eq('key', key);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
