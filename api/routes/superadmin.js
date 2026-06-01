const express = require('express');
const crypto = require('crypto');
const validateTma = require('../middleware/validateTma');
const { supabase } = require('../../db/index');
const { sendMessage } = require('../services/notify');
const { getGeoRate } = require('../lib/geoRate');
const { getSettings, invalidateCache, DEFAULTS } = require('../services/platformSettings');

const router = express.Router();

const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TG_ID;

function buildCheckinDeepLink(token) {
  const bot = process.env.BOT_USERNAME || 'GeoEarnBot';
  const app = process.env.BOT_APP_SHORT_NAME;
  return app
    ? `https://t.me/${bot}/${app}?startapp=${token}`
    : `https://t.me/${bot}?start=${token}`;
}

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

    const totalGeoIssued  = (geoIssuedRow?.sum ?? geoIssuedRow?.rewarded) || 0;
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

    const qrUrl = buildCheckinDeepLink(business.qr_token);

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
      { data: activeCampsData },
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
      supabase.from('campaigns').select('business_id').eq('active', true),
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
    const totalGeoIssued = (geoIssuedRow?.sum ?? geoIssuedRow?.rewarded) || 0;
    const approvedGeo    = (approvedWds  || []).reduce((s, w) => s + (w.amount || 0), 0);

    const activeBiz = new Set((activeCampsData || []).map(c => c.business_id).filter(Boolean)).size;

    return res.json({
      dau, dauTrend,
      mau, mauTrend,
      checkinsToday:      checkinsToday || 0,
      pendingWithdrawals: pendingCount  || 0,
      pendingGeo,
      platformBalance:    platform?.balance || 0,
      totalBiz:           totalBiz || 0,
      bizZeroBalance:     bizZero  || 0,
      activeBiz,
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
    if (!userId || !Number.isFinite(amount)) return res.status(400).json({ error: 'INVALID_PARAMS' });
    if (!note?.trim()) return res.status(400).json({ error: 'NOTE_REQUIRED' });

    const { data: userRow } = await supabase.from('users').select('balance').eq('id', userId).single();
    if (!userRow) return res.status(404).json({ error: 'NOT_FOUND' });

    const newBalance = Math.round(Math.max(0, userRow.balance + amount));
    const { error } = await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });

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
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });

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
    if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });

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

    const now = new Date();
    const campaigns = (data || []).map(c => ({
      ...c,
      qrUrl:       buildCheckinDeepLink(c.token),
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
        active:         true,
      })
      .select()
      .single();

    if (error) throw error;

    const qrUrl = buildCheckinDeepLink(token);

    try {
      await supabase.from('sa_audit_log').insert({
        action: 'promo_campaign_create', target_id: campaign.id, admin_id: Number(SUPER_ADMIN_ID),
        note: `${rarity} · ${reward_amount} GEO · ${max_claims} claims · "${title}"`,
      });
    } catch (_) {}

    return res.json({ campaign, qrUrl });
  } catch (err) {
    console.error('superadmin/promo-campaigns POST', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
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

    return res.json({
      promo: { ...promo, qrUrl: buildCheckinDeepLink(promo.token) },
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

// ── Platform wallet history ───────────────────────────────────────────────────
// Merges all platform_wallet credit/debit sources into a single chronological feed.
// Credits: campaign commissions (platform_transactions)
// Debits:  approved withdrawals, promo QR claims, geohunt claims

router.get('/api/superadmin/platform-wallet/history', ...SA, async (req, res) => {
  try {
    const LIMIT = 50;

    const [ptRes, wdRes, promoRes, ghCodesRes, refEarningsRes] = await Promise.all([
      supabase.from('platform_transactions')
        .select('id, amount, created_at, business_id')
        .order('created_at', { ascending: false })
        .limit(LIMIT),
      // Show all withdrawal statuses so pending payouts also appear
      supabase.from('withdrawals')
        .select('id, amount, created_at, user_id, status')
        .in('status', ['approved', 'pending'])
        .order('created_at', { ascending: false })
        .limit(LIMIT),
      supabase.from('promo_claims')
        .select('id, geo_awarded, claimed_at, promo_id, user_id')
        .order('claimed_at', { ascending: false })
        .limit(LIMIT),
      supabase.from('geohunt_codes')
        .select('id, used_at, hunt_id, used_by')
        .not('used_at', 'is', null)
        .order('used_at', { ascending: false })
        .limit(LIMIT),
      // Referral bonus payouts from platform wallet
      supabase.from('referral_earnings')
        .select('id, amount, created_at, referrer_id, referred_id')
        .order('created_at', { ascending: false })
        .limit(LIMIT),
    ]);

    // Two-step lookups
    const bizIds   = [...new Set((ptRes.data  || []).map(r => r.business_id).filter(Boolean))];
    const userIds  = [...new Set([
      ...(wdRes.data          || []).map(r => r.user_id),
      ...(promoRes.data       || []).map(r => r.user_id),
      ...(ghCodesRes.data     || []).map(r => r.used_by),
      ...(refEarningsRes.data || []).map(r => r.referrer_id),
      ...(refEarningsRes.data || []).map(r => r.referred_id),
    ].filter(Boolean))];
    const promoIds = [...new Set((promoRes.data  || []).map(r => r.promo_id).filter(Boolean))];
    const huntIds  = [...new Set((ghCodesRes.data || []).map(r => r.hunt_id).filter(Boolean))];

    const [bizMap, userMap, promoMap, huntMap] = await Promise.all([
      bizIds.length  ? supabase.from('businesses').select('id, name').in('id', bizIds).then(r => Object.fromEntries((r.data||[]).map(x=>[x.id,x])))   : {},
      userIds.length ? supabase.from('users').select('id, telegram_id, username').in('id', userIds).then(r => Object.fromEntries((r.data||[]).map(x=>[x.id,x]))) : {},
      promoIds.length? supabase.from('promo_campaigns').select('id, title').in('id', promoIds).then(r => Object.fromEntries((r.data||[]).map(x=>[x.id,x]))) : {},
      huntIds.length ? supabase.from('geohunts').select('id, title, reward_per_code').in('id', huntIds).then(r => Object.fromEntries((r.data||[]).map(x=>[x.id,x]))) : {},
    ]);

    const items = [];

    for (const tx of ptRes.data || []) {
      const biz = bizMap[tx.business_id];
      items.push({
        id:         `pt_${tx.id}`,
        type:       'commission',
        direction:  'credit',
        amount:     tx.amount,
        label:      `Комиссия: ${biz?.name || `biz#${tx.business_id}`}`,
        created_at: tx.created_at,
      });
    }

    for (const wd of wdRes.data || []) {
      const u = userMap[wd.user_id];
      items.push({
        id:         `wd_${wd.id}`,
        type:       wd.status === 'pending' ? 'withdrawal_pending' : 'withdrawal',
        direction:  'debit',
        amount:     wd.amount,
        label:      `Вывод${wd.status === 'pending' ? ' (ожидает)' : ''}: ${u?.username ? '@' + u.username : u?.telegram_id || '—'}`,
        created_at: wd.created_at,
      });
    }

    for (const p of promoRes.data || []) {
      const promo = promoMap[p.promo_id];
      const u     = userMap[p.user_id];
      items.push({
        id:         `pc_${p.id}`,
        type:       'promo',
        direction:  'debit',
        amount:     p.geo_awarded,
        label:      `Promo QR: ${promo?.title || '—'}${u?.username ? ' · @' + u.username : ''}`,
        created_at: p.claimed_at,
      });
    }

    for (const g of ghCodesRes.data || []) {
      const hunt = huntMap[g.hunt_id];
      const u    = userMap[g.used_by];
      items.push({
        id:         `gh_${g.id}`,
        type:       'geohunt',
        direction:  'debit',
        amount:     hunt?.reward_per_code || 0,
        label:      `GeoHunt: ${hunt?.title || '—'}${u?.username ? ' · @' + u.username : ''}`,
        created_at: g.used_at,
      });
    }

    for (const r of refEarningsRes.data || []) {
      const referrer  = userMap[r.referrer_id];
      const referred  = userMap[r.referred_id];
      items.push({
        id:         `re_${r.id}`,
        type:       'referral_bonus',
        direction:  'debit',
        amount:     r.amount,
        label:      `Реф. бонус: ${referrer?.username ? '@' + referrer.username : referrer?.telegram_id || '—'} ← ${referred?.username ? '@' + referred.username : referred?.telegram_id || '—'}`,
        created_at: r.created_at,
      });
    }

    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ history: items.slice(0, LIMIT) });
  } catch (err) {
    console.error('superadmin/platform-wallet/history', err);
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
    if (error) return res.status(400).json({ error: 'CONSTRAINT_VIOLATION' });
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
    if (error) return res.status(400).json({ error: 'CONSTRAINT_VIOLATION' });
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

// ── Support messages ──────────────────────────────────────────────────────────

router.get('/api/superadmin/support', ...SA, async (req, res) => {
  try {
    const status = req.query.status || 'open';
    let query = supabase
      .from('support_messages')
      .select('*, users(telegram_id, username)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ messages: data || [] });
  } catch (e) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/superadmin/support/:id/reply', ...SA, async (req, res) => {
  try {
    const msgId = parseInt(req.params.id, 10);
    const { reply } = req.body;
    if (!reply || typeof reply !== 'string' || !reply.trim()) {
      return res.status(400).json({ error: 'REPLY_REQUIRED' });
    }

    const { data: msg, error: fetchErr } = await supabase
      .from('support_messages')
      .select('*, users(telegram_id, username)')
      .eq('id', msgId)
      .single();
    if (fetchErr || !msg) return res.status(404).json({ error: 'NOT_FOUND' });

    const { error: updErr } = await supabase
      .from('support_messages')
      .update({ status: 'replied', admin_reply: reply.trim(), replied_at: new Date().toISOString() })
      .eq('id', msgId);
    if (updErr) throw updErr;

    const userTgId = msg.users?.telegram_id;
    if (userTgId) {
      const typeLabel = msg.type === 'report' ? 'вашей жалобе' : 'вашему обращению';
      await sendMessage(
        userTgId,
        `📨 Ответ по ${typeLabel} #${msgId}:\n\n${reply.trim()}\n\n— Команда GeoEarn`
      ).catch(() => {});
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('support reply error', e.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/superadmin/support/:id/close', ...SA, async (req, res) => {
  try {
    const msgId = parseInt(req.params.id, 10);
    const { error } = await supabase
      .from('support_messages')
      .update({ status: 'closed' })
      .eq('id', msgId);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Broadcast ─────────────────────────────────────────────────────────────────

router.get('/api/superadmin/broadcast/counts', ...SA, async (req, res) => {
  try {
    const [
      { count: allCount },
      { data: v7 },
      { data: v30 },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).not('telegram_id', 'is', null),
      supabase.from('visits').select('user_id').gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString()),
      supabase.from('visits').select('user_id').gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString()),
    ]);
    return res.json({
      all:        allCount || 0,
      active_7d:  new Set((v7  || []).map(v => v.user_id)).size,
      active_30d: new Set((v30 || []).map(v => v.user_id)).size,
    });
  } catch (err) {
    console.error('superadmin/broadcast/counts', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/superadmin/broadcast', ...SA, async (req, res) => {
  try {
    const { message, target = 'all' } = req.body;
    if (!message?.trim() || message.trim().length < 5)
      return res.status(400).json({ error: 'INVALID_MESSAGE' });
    if (message.trim().length > 4096)
      return res.status(400).json({ error: 'MESSAGE_TOO_LONG' });
    if (!['all', 'active_7d', 'active_30d'].includes(target))
      return res.status(400).json({ error: 'INVALID_TARGET' });

    let telegramIds;

    if (target === 'all') {
      const { data } = await supabase.from('users')
        .select('telegram_id').not('telegram_id', 'is', null);
      telegramIds = (data || []).map(u => u.telegram_id);
    } else {
      const days  = target === 'active_7d' ? 7 : 30;
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: visits } = await supabase.from('visits')
        .select('user_id').gte('created_at', since);
      const userIds = [...new Set((visits || []).map(v => v.user_id))];
      if (userIds.length === 0) return res.json({ sent: 0, failed: 0, total: 0 });
      const { data: users } = await supabase.from('users')
        .select('telegram_id').in('id', userIds).not('telegram_id', 'is', null);
      telegramIds = (users || []).map(u => u.telegram_id);
    }

    if (telegramIds.length === 0) return res.json({ sent: 0, failed: 0, total: 0 });

    const token = process.env.BOT_TOKEN;
    const text  = message.trim();
    const BATCH = 25;
    let sent = 0, failed = 0;

    for (let i = 0; i < telegramIds.length; i += BATCH) {
      const batch   = telegramIds.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async tgId => {
        try {
          const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ chat_id: String(tgId), text, parse_mode: 'Markdown' }),
          });
          return r.ok;
        } catch (_) { return false; }
      }));
      results.forEach(ok => ok ? sent++ : failed++);
      if (i + BATCH < telegramIds.length) await new Promise(r => setTimeout(r, 1000));
    }

    try {
      await supabase.from('sa_audit_log').insert({
        action:    'broadcast',
        admin_id:  Number(SUPER_ADMIN_ID),
        note:      `target=${target} sent=${sent}/${telegramIds.length}: "${text.slice(0, 60)}"`,
      });
    } catch (_) {}

    return res.json({ sent, failed, total: telegramIds.length });
  } catch (err) {
    console.error('superadmin/broadcast', err);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── Platform settings (bonuses) ──────────────────────────────────────────────

router.get('/api/superadmin/platform-settings', ...SA, async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ settings, defaults: DEFAULTS });
  } catch (e) {
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.put('/api/superadmin/platform-settings/:key', ...SA, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (!(key in DEFAULTS)) return res.status(400).json({ error: 'UNKNOWN_KEY' });
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return res.status(400).json({ error: 'INVALID_VALUE' });
  const { error } = await supabase
    .from('platform_settings')
    .upsert({ key, value: num, updated_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: 'INTERNAL_ERROR' });
  invalidateCache();
  res.json({ ok: true, key, value: num });
});

module.exports = router;
