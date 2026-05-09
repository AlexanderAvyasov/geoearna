import { useEffect, useState } from 'react';
import { Users, MapPin, Store, Megaphone, Bell, Smartphone, User, Clock, FileText, CheckCircle, XCircle, Loader2, Wallet, BarChart2, ArrowDownToLine, Shield, Lock, TrendingUp } from 'lucide-react';
import { user, initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { formatGeo, formatUzs, geoToUzs } from '../lib/geo';
import { C, G, cardBase } from '../lib/design';

const SA_ID = 930826522;
const isSA  = user?.id === SA_ID;

// ── helpers ──────────────────────────────────────────────────────────────────

const H = { initdata: initData };

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

async function saFetch(path, opts = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { ...H, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  return r.json();
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skel({ h = 16, w = '100%', r = 8 }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r, flexShrink: 0,
      background: `linear-gradient(90deg, ${C.card} 0%, rgba(255,255,255,0.06) 50%, ${C.card} 100%)`,
      backgroundSize: '600px 100%',
      animation: 'shimmer 1.6s ease-in-out infinite',
    }} />
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────

function Badge({ status }) {
  const MAP = {
    pending:   { label: 'Ожидает',   color: C.gold,   bg: C.goldFt },
    approved:  { label: 'Одобрено',  color: C.geo,    bg: C.geoFt  },
    rejected:  { label: 'Отклонено', color: C.red,    bg: C.redFt  },
    confirmed: { label: 'Зачислено', color: C.geo,    bg: C.geoFt  },
  };
  const s = MAP[status] || { label: status, color: C.t3, bg: C.b0 };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px',
      borderRadius: 8, background: s.bg, color: s.color,
      border: `1px solid ${s.color}40`,
    }}>
      {s.label}
    </span>
  );
}

// ── Dashboard tab ─────────────────────────────────────────────────────────────

function Dashboard({ geoRate = 1 }) {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    saFetch('/api/superadmin/stats')
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: 'Пользователи',   val: stats.userCount,       Icon: Users,      color: C.blue },
    { label: 'Визиты',         val: stats.visitCount,      Icon: MapPin,     color: C.geo  },
    { label: 'Бизнесы',        val: stats.bizCount,        Icon: Store,      color: C.gold },
    { label: 'Кампании (акт)', val: stats.activeCampaigns, Icon: Megaphone,  color: C.orange },
  ] : [];

  return (
    <div>
      {/* Platform wallet */}
      <div style={{
        background: G.gold, borderRadius: 20, padding: '22px',
        marginBottom: 16, boxShadow: `0 8px 32px ${C.goldGl}`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Wallet size={12} color="rgba(0,0,0,0.5)" />
          Платформа — комиссии
        </div>
        {loading
          ? <Skel h={44} w={180} r={10} />
          : <>
              <div style={{ fontSize: 38, fontWeight: 900, color: '#1a0a00', letterSpacing: -1 }}>
                {formatGeo(stats?.platformBalance)} <span style={{ fontSize: 18, opacity: 0.6 }}>GEO</span>
              </div>
              <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.5)', marginTop: 4 }}>
                ≈ {formatUzs(geoToUzs(stats?.platformBalance || 0, geoRate))} UZS
              </div>
            </>
        }
      </div>

      {/* Pending withdrawals alert */}
      {!loading && stats?.pendingWithdrawals > 0 && (
        <div style={{
          background: C.redFt, border: `1.5px solid ${C.red}40`,
          borderRadius: 14, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Bell size={20} color={C.red} strokeWidth={2} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.red }}>
              {stats.pendingWithdrawals} заявок на вывод
            </div>
            <div style={{ fontSize: 12, color: C.t3 }}>
              {formatGeo(stats.pendingGeo)} GEO ожидают обработки
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {loading
          ? [1,2,3,4].map(i => <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: 16, borderRadius: 16 }}><Skel h={28} w="60%" r={8} /><div style={{ marginTop: 8 }}><Skel h={12} w="40%" r={6} /></div></div>)
          : cards.map(c => (
            <div key={c.label} style={{ ...cardBase, border: `1px solid ${C.b1}`, borderRadius: 16, padding: '16px 14px' }}>
              <c.Icon size={22} color={c.color} strokeWidth={1.75} style={{ marginBottom: 6 }} />
              <div style={{ fontSize: 26, fontWeight: 900, color: c.color, letterSpacing: -0.5 }}>
                {c.val.toLocaleString('ru-RU')}
              </div>
              <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{c.label}</div>
            </div>
          ))
        }
      </div>

      {/* GEO economy summary */}
      {!loading && stats && (
        <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '18px', borderRadius: 18 }}>
          <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={12} color={C.t3} />
            GEO Экономика
          </div>
          {[
            { label: 'Всего выдано пользователям', val: `${formatGeo(stats.totalGeoIssued)} GEO`, color: C.geo },
            { label: 'Выведено пользователями', val: `${formatGeo(stats.approvedGeo)} GEO`, color: C.blue },
            { label: 'На выводе (ожидает)', val: `${formatGeo(stats.pendingGeo)} GEO`, color: C.gold },
            { label: 'Комиссий собрано', val: `${formatGeo(stats.platformBalance)} GEO`, color: C.orange },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 10, borderBottom: `1px solid ${C.b0}` }}>
              <span style={{ fontSize: 13, color: C.t3 }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: row.color }}>{row.val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Withdrawals tab ───────────────────────────────────────────────────────────

function Withdrawals({ geoRate = 1 }) {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('pending');
  const [rejectId, setRejectId] = useState(null);
  const [note,    setNote]    = useState('');
  const [busy,    setBusy]    = useState({});

  function load() {
    setLoading(true);
    const qs = filter === 'all' ? '' : `?status=${filter}`;
    saFetch(`/api/superadmin/withdrawals${qs}`)
      .then(d => setList(d.withdrawals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filter]);

  async function approve(id) {
    setBusy(b => ({ ...b, [id]: true }));
    await saFetch(`/api/superadmin/withdrawals/${id}/approve`, { method: 'POST' });
    setList(l => l.map(w => w.id === id ? { ...w, status: 'approved' } : w));
    setBusy(b => ({ ...b, [id]: false }));
  }

  async function reject(id) {
    setBusy(b => ({ ...b, [id]: true }));
    await saFetch(`/api/superadmin/withdrawals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
    setList(l => l.map(w => w.id === id ? { ...w, status: 'rejected', note } : w));
    setRejectId(null);
    setNote('');
    setBusy(b => ({ ...b, [id]: false }));
  }

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'pending',  label: 'Ожидают' },
          { key: 'approved', label: 'Одобрены' },
          { key: 'rejected', label: 'Отклонены' },
          { key: 'all',      label: 'Все' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 700,
            border: `1.5px solid ${filter === f.key ? C.blue : C.b1}`,
            background: filter === f.key ? C.blueFt : 'transparent',
            color: filter === f.key ? C.blue : C.t3,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && [1,2,3].map(i => (
        <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '14px 16px', marginBottom: 10, borderRadius: 16 }}>
          <Skel h={14} w="60%" r={6} /><div style={{ marginTop: 8 }}><Skel h={10} w="40%" r={5} /></div>
        </div>
      ))}

      {!loading && list.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.t3 }}>
          <CheckCircle size={48} color={C.geo} strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
          <div style={{ fontWeight: 700 }}>Нет заявок</div>
        </div>
      )}

      {!loading && list.map(w => (
        <div key={w.id} style={{
          ...cardBase,
          border: `1px solid ${w.status === 'pending' ? C.gold + '50' : C.b1}`,
          padding: '16px', marginBottom: 10, borderRadius: 16,
          animation: 'fadeUp 0.3s ease both',
        }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, color: C.geo, letterSpacing: -0.5 }}>
                {formatGeo(w.amount)} GEO
              </div>
              <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>
                ≈ {formatUzs(geoToUzs(w.amount, geoRate))} UZS
              </div>
            </div>
            <Badge status={w.status} />
          </div>

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: w.status === 'pending' ? 14 : 0 }}>
            <div style={{ fontSize: 13, color: C.t2, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Smartphone size={12} color={C.t3} />
              <span style={{ fontFamily: 'monospace', color: C.blue }}>{w.phone}</span>
            </div>
            <div style={{ fontSize: 12, color: C.t3, display: 'flex', alignItems: 'center', gap: 5 }}>
              <User size={11} color={C.t3} />
              {w.users?.username ? `@${w.users.username}` : `tg:${w.users?.telegram_id}`}
              {w.users?.balance != null && <span style={{ color: C.t3 }}> · остаток {formatGeo(w.users.balance)} GEO</span>}
            </div>
            <div style={{ fontSize: 11, color: C.t3, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={10} color={C.t3} />
              {fmtDate(w.created_at)}
              {w.processed_at && ` → ${fmtDate(w.processed_at)}`}
            </div>
            {w.note && (
              <div style={{ fontSize: 12, color: C.orange, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                <FileText size={11} color={C.orange} />
                {w.note}
              </div>
            )}
          </div>

          {/* Action buttons */}
          {w.status === 'pending' && (
            rejectId === w.id ? (
              <div>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Причина отказа (необязательно)"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px', borderRadius: 10,
                    border: `1.5px solid ${C.red}60`,
                    background: C.redFt, color: C.t1,
                    fontSize: 14, outline: 'none', marginBottom: 8,
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setRejectId(null); setNote(''); }} style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    border: `1px solid ${C.b2}`, background: 'transparent',
                    color: C.t3, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>Отмена</button>
                  <button onClick={() => reject(w.id)} disabled={busy[w.id]} style={{
                    flex: 2, padding: '10px', borderRadius: 10,
                    border: 'none', background: C.red,
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    opacity: busy[w.id] ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {busy[w.id]
                      ? <Loader2 size={15} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                      : <><XCircle size={15} color="#fff" /> Отклонить и вернуть GEO</>
                    }
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setRejectId(w.id)} style={{
                  flex: 1, padding: '11px', borderRadius: 12,
                  border: `1.5px solid ${C.red}60`, background: C.redFt,
                  color: C.red, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  <XCircle size={15} color={C.red} />
                  Отклонить
                </button>
                <button onClick={() => approve(w.id)} disabled={busy[w.id]} style={{
                  flex: 2, padding: '11px', borderRadius: 12,
                  border: 'none', background: G.geo,
                  color: '#071a0c', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  boxShadow: `0 4px 14px ${C.geoGl}`,
                  opacity: busy[w.id] ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  {busy[w.id]
                    ? <Loader2 size={15} color="#071a0c" style={{ animation: 'spin 1s linear infinite' }} />
                    : <><CheckCircle size={15} color="#071a0c" /> Одобрить (оплатить)</>
                  }
                </button>
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    saFetch('/api/superadmin/users')
      .then(d => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? users.filter(u =>
        u.username?.toLowerCase().includes(search.toLowerCase()) ||
        String(u.telegram_id).includes(search)
      )
    : users;

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Поиск по @username или ID..."
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '12px 14px', borderRadius: 12,
          border: `1.5px solid ${C.b2}`,
          background: C.card, color: C.t1,
          fontSize: 15, outline: 'none', marginBottom: 12,
          WebkitAppearance: 'none',
        }}
      />

      {loading && [1,2,3,4,5].map(i => (
        <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '12px 16px', marginBottom: 8, borderRadius: 14, display: 'flex', justifyContent: 'space-between' }}>
          <Skel h={14} w={140} r={6} /><Skel h={18} w={80} r={6} />
        </div>
      ))}

      {!loading && filtered.map((u, i) => (
        <div key={u.id} style={{
          ...cardBase, border: `1px solid ${C.b1}`,
          padding: '12px 16px', marginBottom: 8, borderRadius: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          animation: `fadeUp 0.3s ${i * 0.03}s ease both`,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.t1 }}>
              {u.username ? `@${u.username}` : `ID ${u.telegram_id}`}
            </div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
              {u.visit_count} визитов · {fmtDate(u.created_at).split(',')[0]}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: u.balance > 0 ? C.geo : C.t3 }}>
              {formatGeo(u.balance)}
            </div>
            <div style={{ fontSize: 10, color: C.t3 }}>GEO</div>
          </div>
        </div>
      ))}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.t3 }}>Нет пользователей</div>
      )}
    </div>
  );
}

// ── Businesses tab ─────────────────────────────────────────────────────────────

function Businesses() {
  const [businesses, setBusinesses] = useState([]);
  const [topups,     setTopups]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [busy,       setBusy]       = useState({});

  useEffect(() => {
    Promise.all([
      saFetch('/api/superadmin/businesses'),
      saFetch('/api/superadmin/topups'),
    ])
      .then(([b, t]) => {
        setBusinesses(b.businesses || []);
        setTopups(t.topups || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function confirmTopup(id) {
    setBusy(b => ({ ...b, [id]: true }));
    await saFetch(`/api/superadmin/topups/${id}/confirm`, { method: 'POST' });
    setTopups(t => t.map(r => r.id === id ? { ...r, status: 'confirmed' } : r));
    saFetch('/api/superadmin/businesses')
      .then(d => setBusinesses(d.businesses || []))
      .catch(() => {});
    setBusy(b => ({ ...b, [id]: false }));
  }

  const pendingTopups = topups.filter(t => t.status === 'pending');

  return (
    <div>
      {/* Pending topup requests */}
      {!loading && pendingTopups.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Wallet size={11} color={C.gold} />
            Заявки на пополнение ({pendingTopups.length})
          </div>
          {pendingTopups.map(t => (
            <div key={t.id} style={{
              ...cardBase, border: `1.5px solid ${C.gold}50`,
              padding: '14px 16px', marginBottom: 8, borderRadius: 14,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: C.gold }}>
                    {t.amount.toLocaleString('ru-RU')} GEO
                  </div>
                  <div style={{ fontSize: 12, color: C.t3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Store size={11} color={C.t3} />
                    {t.businesses?.name} · {fmtDate(t.created_at)}
                  </div>
                </div>
                <Badge status={t.status} />
              </div>
              <button onClick={() => confirmTopup(t.id)} disabled={busy[t.id]} style={{
                width: '100%', padding: '11px', borderRadius: 12,
                border: 'none', background: G.gold,
                color: '#1a0a00', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                boxShadow: `0 4px 14px ${C.goldGl}`,
                opacity: busy[t.id] ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                {busy[t.id]
                  ? <Loader2 size={16} color="#1a0a00" style={{ animation: 'spin 1s linear infinite' }} />
                  : <><CheckCircle size={16} color="#1a0a00" /> Подтвердить пополнение</>
                }
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Business list */}
      <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
        Все заведения
      </div>

      {loading && [1,2,3].map(i => (
        <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '14px 16px', marginBottom: 10, borderRadius: 16 }}>
          <Skel h={15} w="55%" r={6} /><div style={{ marginTop: 8 }}><Skel h={11} w="35%" r={5} /></div>
        </div>
      ))}

      {!loading && businesses.map((b, i) => {
        const activeCamp = b.campaigns?.find(c => c.active);
        const totalCamps = b.campaigns?.length || 0;
        return (
          <div key={b.id} style={{
            ...cardBase, border: `1px solid ${C.b1}`,
            padding: '14px 16px', marginBottom: 10, borderRadius: 16,
            animation: `fadeUp 0.3s ${i * 0.04}s ease both`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.t1, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.name}
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginBottom: 4 }}>
                  {b.address || '—'}
                </div>
                <div style={{ fontSize: 11, color: C.t3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={10} color={C.t3} />
                  tg:{b.owner_telegram_id || '—'} · {totalCamps} кампаний
                  {activeCamp && (
                    <span style={{ color: C.geo, marginLeft: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: C.geo, boxShadow: `0 0 4px ${C.geo}` }} />
                      активна
                    </span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: b.balance > 0 ? C.t1 : C.t3 }}>
                  {formatGeo(b.balance)}
                </div>
                <div style={{ fontSize: 10, color: C.t3 }}>GEO</div>
              </div>
            </div>

            {activeCamp && (
              <div style={{
                marginTop: 10, background: C.geoFt, border: `1px solid ${C.geoGl}`,
                borderRadius: 10, padding: '8px 12px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: C.geo, fontWeight: 600 }}>
                  {activeCamp.visits_count}/{activeCamp.max_visits} визитов
                </span>
                <span style={{ fontSize: 12, color: C.geo, fontWeight: 700 }}>
                  +{formatGeo(activeCamp.reward_amount)} GEO/визит
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── useGeoRate ────────────────────────────────────────────────────────────────

function useGeoRate() {
  const [rate, setRate] = useState(1);
  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then(r => r.json())
      .then(d => { if (d.geoRate) setRate(d.geoRate); })
      .catch(() => {});
  }, []);
  return rate;
}

// ── Main SuperAdmin page ──────────────────────────────────────────────────────

const TABS = [
  { key: 'dashboard',   label: 'Дашборд',  Icon: BarChart2        },
  { key: 'withdrawals', label: 'Выводы',   Icon: ArrowDownToLine  },
  { key: 'users',       label: 'Юзеры',    Icon: Users            },
  { key: 'businesses',  label: 'Бизнесы',  Icon: Store            },
];

export default function SuperAdmin() {
  const [tab, setTab] = useState('dashboard');
  const geoRate = useGeoRate();

  if (!isSA) {
    return (
      <div style={{
        minHeight: '100vh', background: C.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: 32,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(255,59,92,0.08)',
          border: `1.5px solid rgba(255,59,92,0.2)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <Lock size={36} color={C.red} strokeWidth={1.75} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 20, color: C.t1, marginBottom: 8 }}>Доступ запрещён</div>
        <div style={{ color: C.t3, fontSize: 14 }}>Только для администратора платформы</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.4s ease both' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(160deg, #0A0510 0%, #150A20 60%, #0A0510 100%)',
        padding: '32px 20px 52px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(160,80,255,0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={12} color='#A050FF' />
          Super Admin
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.t1, letterSpacing: -0.5, marginBottom: 4 }}>
          GeoEarn Platform
        </div>
        <div style={{ fontSize: 13, color: C.t3 }}>
          ID {SA_ID} · Полный доступ
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,9,14,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.b1}`,
        marginTop: -24,
        display: 'flex', overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: '0 0 auto',
            padding: '14px 16px',
            background: 'none', border: 'none',
            borderBottom: `2.5px solid ${tab === t.key ? '#A050FF' : 'transparent'}`,
            color: tab === t.key ? '#A050FF' : C.t3,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <t.Icon size={14} color={tab === t.key ? '#A050FF' : C.t3} strokeWidth={tab === t.key ? 2.5 : 1.75} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 16px 100px' }}>
        {tab === 'dashboard'   && <Dashboard   geoRate={geoRate} />}
        {tab === 'withdrawals' && <Withdrawals geoRate={geoRate} />}
        {tab === 'users'       && <UsersTab />}
        {tab === 'businesses'  && <Businesses />}
      </div>
    </div>
  );
}
