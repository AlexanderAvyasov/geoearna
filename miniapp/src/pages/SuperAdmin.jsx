import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, ShieldAlert, Store, Megaphone, Wallet, Users, Settings,
  TrendingUp, TrendingDown, Bell, AlertTriangle, CheckCircle, XCircle,
  Loader2, Clock, User, Smartphone, FileText, MapPin, Lock, Shield,
  RefreshCw, Search, Zap, Activity, BarChart3, DollarSign,
  ChevronRight, Plus, Minus, Ban, UserCheck, PauseCircle, PlayCircle,
  ArrowDownToLine, Coins, Star,
} from 'lucide-react';
import { user, initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { formatGeo, formatUzs, geoToUzs } from '../lib/geo';
import { C, G, cardBase } from '../lib/design';

// ─── constants ────────────────────────────────────────────────────────────────

const SA_ID    = 930826522;
const isSA     = user?.id === SA_ID;
const SA_COLOR = '#A050FF';
const H        = { initdata: initData };

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtDay(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

async function saFetch(path, opts = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { ...H, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error || 'API_ERROR'), { detail: data.detail });
  return data;
}

// ─── shared components ────────────────────────────────────────────────────────

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

function Badge({ label, color, bg }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 8px',
      borderRadius: 8, background: bg || `${color}18`, color,
      border: `1px solid ${color}40`, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function StatusBadge({ status }) {
  const MAP = {
    pending:   { label: 'Ожидает',   color: C.gold  },
    approved:  { label: 'Одобрено',  color: '#10B981' },
    rejected:  { label: 'Отклонено', color: C.red   },
    confirmed: { label: 'Зачислено', color: '#10B981' },
  };
  const s = MAP[status] || { label: status, color: C.t3 };
  return <Badge label={s.label} color={s.color} />;
}

function Btn({ children, onClick, variant = 'primary', size = 'sm', disabled, loading, style = {} }) {
  const variants = {
    primary:  { background: G.accent, color: '#fff', border: 'none' },
    danger:   { background: C.redFt,  color: C.red,  border: `1.5px solid ${C.red}40` },
    success:  { background: '#10B98118', color: '#10B981', border: `1.5px solid #10B98140` },
    ghost:    { background: 'transparent', color: C.t2, border: `1px solid ${C.b2}` },
    gold:     { background: C.goldFt, color: C.gold, border: `1.5px solid ${C.gold}40` },
    purple:   { background: `${SA_COLOR}18`, color: SA_COLOR, border: `1.5px solid ${SA_COLOR}40` },
  };
  const sizes = {
    sm: { padding: '8px 14px', fontSize: 13, borderRadius: 10 },
    md: { padding: '12px 18px', fontSize: 14, borderRadius: 12 },
    lg: { padding: '15px', fontSize: 15, borderRadius: 14, width: '100%' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...variants[variant],
        ...sizes[size],
        fontWeight: 700, cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || loading) ? 0.55 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'all 0.15s', WebkitTapHighlightColor: 'transparent',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : children}
    </button>
  );
}

function SectionTitle({ icon: Icon, children, color = C.t3, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && <Icon size={12} color={color} strokeWidth={2} />}
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {children}
        </span>
      </div>
      {action}
    </div>
  );
}

function Empty({ icon: Icon = Activity, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 16px', color: C.t3 }}>
      <Icon size={44} color={C.t3} strokeWidth={1.25} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
      <div style={{ fontSize: 14, fontWeight: 600 }}>{text}</div>
    </div>
  );
}

function Trend({ val }) {
  if (val === null || val === undefined) return null;
  const up = val >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: up ? '#10B981' : C.red, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Icon size={11} />
      {up ? '+' : ''}{val}%
    </span>
  );
}

function StatCard({ Icon, label, value, sub, color, trend, alert }) {
  return (
    <div style={{
      ...cardBase, border: `1px solid ${alert ? `${C.red}50` : C.b1}`,
      padding: '16px 14px', borderRadius: 16,
      background: alert ? `${C.red}08` : C.card,
    }}>
      <Icon size={20} color={color || C.t3} strokeWidth={1.75} style={{ marginBottom: 8 }} />
      <div style={{ fontSize: 26, fontWeight: 900, color: alert ? C.red : (color || C.t1), letterSpacing: -0.5, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.t3, marginTop: 4, marginBottom: trend ? 4 : 0 }}>{label}</div>
      {trend !== undefined && <Trend val={trend} />}
      {sub && <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    saFetch('/api/superadmin/overview')
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const d = data || {};

  return (
    <div>
      {/* Platform wallet hero */}
      <div style={{
        background: G.gold, borderRadius: 20, padding: '22px 20px',
        marginBottom: 16, position: 'relative', overflow: 'hidden',
        boxShadow: `0 8px 32px ${C.goldGl}`,
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Wallet size={12} color="rgba(0,0,0,0.5)" />
          Комиссионный кошелёк
        </div>
        {loading
          ? <Skel h={40} w={160} r={10} />
          : <>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#1a0a00', letterSpacing: -1 }}>
                {formatGeo(d.platformBalance)} <span style={{ fontSize: 16, opacity: 0.55 }}>GEO</span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>
                ≈ {formatUzs(geoToUzs(d.platformBalance || 0, d.geoRate || 1000))} UZS
              </div>
            </>
        }
      </div>

      {/* Pending withdrawals alert */}
      {!loading && (d.pendingWithdrawals || 0) > 0 && (
        <div style={{
          background: C.redFt, border: `1.5px solid ${C.red}40`,
          borderRadius: 14, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Bell size={20} color={C.red} strokeWidth={2} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.red }}>{d.pendingWithdrawals} заявок на вывод</div>
            <div style={{ fontSize: 12, color: C.t3 }}>{formatGeo(d.pendingGeo)} GEO ожидают обработки</div>
          </div>
          <ChevronRight size={16} color={C.red} />
        </div>
      )}

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {loading
          ? [1,2,3,4,5,6].map(i => (
              <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: 16, borderRadius: 16 }}>
                <Skel h={28} w="60%" r={8} /><div style={{ marginTop: 8 }}><Skel h={12} w="40%" r={5} /></div>
              </div>
            ))
          : <>
              <StatCard Icon={Users}       label="DAU"             value={d.dau || 0}              color={C.blue}    trend={d.dauTrend} sub="сегодня" />
              <StatCard Icon={TrendingUp}  label="MAU"             value={d.mau || 0}              color={C.indigo}  trend={d.mauTrend} sub="этот месяц" />
              <StatCard Icon={MapPin}      label="Чекины сегодня"  value={d.checkinsToday || 0}    color="#10B981"   />
              <StatCard Icon={Store}       label="Бизнесов"        value={d.totalBiz || 0}         color={C.gold}    sub={`${d.bizZeroBalance || 0} с нулём`} />
              <StatCard Icon={Megaphone}   label="Акт. кампании"   value={d.activeCamps || 0}      color={C.orange}  />
              <StatCard Icon={ShieldAlert} label="Подозрительных"  value={d.fraudSuspectsCount || 0} color={C.red}  alert={(d.fraudSuspectsCount || 0) > 0} />
            </>
        }
      </div>

      {/* GEO economy */}
      {!loading && (
        <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '18px', borderRadius: 18, marginBottom: 16 }}>
          <SectionTitle icon={TrendingUp} color={C.t3}>GEO Экономика</SectionTitle>
          {[
            { label: 'Всего выдано',         val: formatGeo(d.totalGeoIssued) + ' GEO',  color: '#10B981' },
            { label: 'Выведено (одобрено)',   val: formatGeo(d.approvedGeo)    + ' GEO',  color: C.blue   },
            { label: 'На выводе (ожидает)',   val: formatGeo(d.pendingGeo)     + ' GEO',  color: C.gold   },
            { label: 'Курс GEO → UZS',       val: `1 GEO = ${d.geoRate || 1000} UZS`,   color: SA_COLOR },
          ].map((row, i, arr) => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingBottom: 10, marginBottom: 10,
              borderBottom: i < arr.length - 1 ? `1px solid ${C.b0}` : 'none',
            }}>
              <span style={{ fontSize: 13, color: C.t3 }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: row.color }}>{row.val}</span>
            </div>
          ))}
        </div>
      )}

      <Btn variant="ghost" size="md" onClick={load} loading={loading} style={{ width: '100%' }}>
        <RefreshCw size={14} />
        Обновить
      </Btn>
    </div>
  );
}

// ─── Tab: Fraud ───────────────────────────────────────────────────────────────

function FraudTab() {
  const [suspects, setSuspects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [banning,  setBanning]  = useState({});

  function load() {
    setLoading(true);
    saFetch('/api/superadmin/fraud')
      .then(d => setSuspects(d.suspects || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function ban(userId, username) {
    if (!confirm(`Забанить ${username || `ID ${userId}`}?`)) return;
    setBanning(b => ({ ...b, [userId]: true }));
    try {
      await saFetch(`/api/superadmin/users/${userId}/ban`, { method: 'POST', body: JSON.stringify({ reason: 'Fraud: подозрительная активность' }) });
      setSuspects(s => s.filter(u => u.db_id !== userId));
    } catch (e) {
      alert(`Ошибка: ${e.message}`);
    }
    setBanning(b => ({ ...b, [userId]: false }));
  }

  const flagColor = { HIGH: C.red, MEDIUM: C.gold };
  const flagLabel = { HIGH: 'ВЫСОКИЙ', MEDIUM: 'СРЕДНИЙ' };

  return (
    <div>
      <div style={{
        background: `${C.red}10`, border: `1.5px solid ${C.red}30`,
        borderRadius: 14, padding: '12px 14px', marginBottom: 16,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <ShieldAlert size={18} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.red, marginBottom: 2 }}>Антифрод — приоритет #1</div>
          <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.5 }}>
            Пользователи, посетившие 3+ разных заведений за 24ч или сделавшие 5+ визитов. Алгоритм обнаружения на основе паттернов.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <SectionTitle icon={ShieldAlert} color={C.red}>Подозрительные ({suspects.length})</SectionTitle>
        <Btn variant="ghost" size="sm" onClick={load} loading={loading}><RefreshCw size={13} /></Btn>
      </div>

      {loading && [1,2,3].map(i => (
        <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '14px 16px', marginBottom: 10, borderRadius: 16 }}>
          <Skel h={14} w="55%" r={6} /><div style={{ marginTop: 8 }}><Skel h={10} w="35%" r={5} /></div>
        </div>
      ))}

      {!loading && suspects.length === 0 && (
        <Empty icon={ShieldAlert} text="Подозрительных активностей не обнаружено" />
      )}

      {!loading && suspects.map((s, i) => (
        <div key={s.user_id} style={{
          ...cardBase,
          border: `1.5px solid ${s.flag === 'HIGH' ? `${C.red}50` : `${C.gold}40`}`,
          padding: '14px 16px', marginBottom: 10, borderRadius: 16,
          animation: `fadeUp 0.3s ease both`,
          animationDelay: `${i * 0.04}s`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.t1, marginBottom: 3 }}>
                {s.username ? `@${s.username}` : `tg: ${s.telegram_id || s.user_id}`}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Badge label={flagLabel[s.flag]} color={flagColor[s.flag]} />
                <Badge label={`${s.distinctBiz24h} заведений`} color={C.orange} />
                <Badge label={`${s.visitCount24h} визитов`}    color={C.blue}   />
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#10B981' }}>+{formatGeo(s.totalGeo24h)}</div>
              <div style={{ fontSize: 11, color: C.t3 }}>GEO за 24ч</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} color={C.t3} />
            Последний визит: {fmtDate(s.lastVisit)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn
              variant="danger" size="sm"
              onClick={() => ban(s.db_id, s.username)}
              loading={banning[s.db_id]}
              style={{ flex: 1 }}
            >
              <Ban size={13} /> Забанить
            </Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Businesses ──────────────────────────────────────────────────────────

function BusinessesTab() {
  const [businesses, setBusinesses] = useState([]);
  const [topups,     setTopups]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [busy,       setBusy]       = useState({});

  useEffect(() => {
    setLoading(true);
    Promise.all([saFetch('/api/superadmin/businesses'), saFetch('/api/superadmin/topups')])
      .then(([b, t]) => { setBusinesses(b.businesses || []); setTopups(t.topups || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function confirmTopup(id) {
    setBusy(b => ({ ...b, [id]: 'topup' }));
    try {
      await saFetch(`/api/superadmin/topups/${id}/confirm`, { method: 'POST' });
      setTopups(t => t.map(r => r.id === id ? { ...r, status: 'confirmed' } : r));
      const d = await saFetch('/api/superadmin/businesses');
      setBusinesses(d.businesses || []);
    } catch (e) { alert(`Ошибка: ${e.message}`); }
    setBusy(b => ({ ...b, [id]: null }));
  }

  async function suspend(biz) {
    if (!confirm(`Приостановить "${biz.name}"?`)) return;
    setBusy(b => ({ ...b, [biz.id]: 'suspend' }));
    try {
      await saFetch(`/api/superadmin/businesses/${biz.id}/suspend`, { method: 'POST', body: JSON.stringify({ reason: 'Admin action' }) });
      setBusinesses(bs => bs.map(b => b.id === biz.id ? { ...b, suspended_at: new Date().toISOString() } : b));
    } catch (e) { alert(`Ошибка: ${e.message}`); }
    setBusy(b => ({ ...b, [biz.id]: null }));
  }

  async function unsuspend(bizId) {
    setBusy(b => ({ ...b, [bizId]: 'unsuspend' }));
    try {
      await saFetch(`/api/superadmin/businesses/${bizId}/unsuspend`, { method: 'POST' });
      setBusinesses(bs => bs.map(b => b.id === bizId ? { ...b, suspended_at: null } : b));
    } catch (e) { alert(`Ошибка: ${e.message}`); }
    setBusy(b => ({ ...b, [bizId]: null }));
  }

  const pendingTopups = topups.filter(t => t.status === 'pending');
  const q = search.toLowerCase();
  const filtered = q
    ? businesses.filter(b => b.name?.toLowerCase().includes(q) || b.address?.toLowerCase().includes(q) || String(b.owner_telegram_id).includes(q))
    : businesses;

  return (
    <div>
      {/* Pending topups */}
      {!loading && pendingTopups.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionTitle icon={Wallet} color={C.gold}>Пополнения ({pendingTopups.length})</SectionTitle>
          {pendingTopups.map(t => (
            <div key={t.id} style={{ ...cardBase, border: `1.5px solid ${C.gold}50`, padding: '14px 16px', marginBottom: 8, borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: C.gold }}>{formatGeo(t.amount)} GEO</div>
                  <div style={{ fontSize: 12, color: C.t3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Store size={11} color={C.t3} />
                    {t.businesses?.name} · {fmtDate(t.created_at)}
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <Btn variant="gold" size="md" onClick={() => confirmTopup(t.id)} loading={busy[t.id] === 'topup'} style={{ width: '100%' }}>
                <CheckCircle size={15} /> Подтвердить зачисление
              </Btn>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Поиск бизнеса..."
        style={{
          width: '100%', boxSizing: 'border-box', marginBottom: 12,
          padding: '11px 14px', borderRadius: 12,
          border: `1.5px solid ${C.b2}`, background: C.card, color: C.t1,
          fontSize: 14, outline: 'none', WebkitAppearance: 'none',
        }}
      />

      <SectionTitle icon={Store} color={C.t3}>Все заведения ({filtered.length})</SectionTitle>

      {loading && [1,2,3].map(i => (
        <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '14px 16px', marginBottom: 10, borderRadius: 16 }}>
          <Skel h={15} w="55%" r={6} /><div style={{ marginTop: 8 }}><Skel h={11} w="35%" r={5} /></div>
        </div>
      ))}

      {!loading && filtered.length === 0 && <Empty icon={Store} text="Нет заведений" />}

      {!loading && filtered.map((b, i) => {
        const activeCamp = b.campaigns?.find(c => c.active);
        const isSuspended = !!b.suspended_at;
        return (
          <div key={b.id} style={{
            ...cardBase,
            border: `1px solid ${isSuspended ? `${C.red}40` : C.b1}`,
            padding: '14px 16px', marginBottom: 10, borderRadius: 16,
            background: isSuspended ? `${C.red}06` : C.card,
            animation: `fadeUp 0.3s ${i * 0.04}s ease both`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.name}
                  </div>
                  {isSuspended && <Badge label="ЗАМОРОЖЕН" color={C.red} />}
                </div>
                <div style={{ fontSize: 11, color: C.t3 }}>
                  {b.address || '—'} · tg:{b.owner_telegram_id} · {b.campaigns?.length || 0} кампаний
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: b.balance > 0 ? C.t1 : C.t3 }}>{formatGeo(b.balance)}</div>
                <div style={{ fontSize: 10, color: C.t3 }}>GEO</div>
              </div>
            </div>
            {activeCamp && (
              <div style={{ background: '#10B98110', border: `1px solid #10B98130`, borderRadius: 10, padding: '7px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>{activeCamp.visits_count}/{activeCamp.max_visits} визитов</span>
                <span style={{ fontSize: 12, color: '#10B981', fontWeight: 700 }}>+{formatGeo(activeCamp.reward_amount)} GEO/визит</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {isSuspended
                ? <Btn variant="success" size="sm" onClick={() => unsuspend(b.id)} loading={busy[b.id] === 'unsuspend'} style={{ flex: 1 }}>
                    <PlayCircle size={13} /> Восстановить
                  </Btn>
                : <Btn variant="danger" size="sm" onClick={() => suspend(b)} loading={busy[b.id] === 'suspend'} style={{ flex: 1 }}>
                    <PauseCircle size={13} /> Заморозить
                  </Btn>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Campaigns ───────────────────────────────────────────────────────────

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('all');
  const [busy,      setBusy]      = useState({});

  useEffect(() => {
    setLoading(true);
    saFetch('/api/superadmin/campaigns')
      .then(d => setCampaigns(d.campaigns || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggle(id, active) {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await saFetch(`/api/superadmin/campaigns/${id}/toggle`, { method: 'POST' });
      setCampaigns(cs => cs.map(c => c.id === id ? { ...c, active: !active } : c));
    } catch (e) { alert(`Ошибка: ${e.message}`); }
    setBusy(b => ({ ...b, [id]: false }));
  }

  const anomalies = campaigns.filter(c => c.isAnomaly && c.active);
  const filtered  = campaigns.filter(c =>
    filter === 'all'      ? true :
    filter === 'active'   ? c.active :
    filter === 'inactive' ? !c.active :
    filter === 'anomaly'  ? c.isAnomaly : true
  );

  return (
    <div>
      {/* Anomaly alert */}
      {!loading && anomalies.length > 0 && (
        <div style={{ background: `${C.red}10`, border: `1.5px solid ${C.red}30`, borderRadius: 14, padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 10 }}>
          <AlertTriangle size={18} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.red }}>
              {anomalies.length} кампания с аномальной наградой
            </div>
            <div style={{ fontSize: 12, color: C.t3 }}>Награда {'>'} 5 000 GEO — требует проверки</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {[['all','Все'],['active','Активные'],['inactive','Остановленные'],['anomaly','Аномалии']].map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            flexShrink: 0, padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700,
            border: `1.5px solid ${filter === k ? SA_COLOR : C.b1}`,
            background: filter === k ? `${SA_COLOR}18` : 'transparent',
            color: filter === k ? SA_COLOR : C.t3, cursor: 'pointer',
          }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading && [1,2,3].map(i => (
        <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '14px 16px', marginBottom: 10, borderRadius: 16 }}>
          <Skel h={14} w="60%" r={6} /><div style={{ marginTop: 8 }}><Skel h={10} w="35%" r={5} /></div>
        </div>
      ))}

      {!loading && filtered.length === 0 && <Empty icon={Megaphone} text="Нет кампаний" />}

      {!loading && filtered.map((c, i) => (
        <div key={c.id} style={{
          ...cardBase,
          border: `1px solid ${c.isAnomaly ? `${C.red}50` : c.active ? `#10B98130` : C.b1}`,
          padding: '14px 16px', marginBottom: 10, borderRadius: 16,
          animation: `fadeUp 0.3s ${i * 0.04}s ease both`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: C.t1 }}>{c.business_name}</span>
                {c.active
                  ? <Badge label="АКТИВНА" color="#10B981" />
                  : <Badge label="ОСТАНОВЛЕНА" color={C.t3} />
                }
                {c.isAnomaly && <Badge label="⚠ АНОМАЛИЯ" color={C.red} />}
              </div>
              <div style={{ fontSize: 11, color: C.t3 }}>
                {c.task_type} · {c.visits_count}/{c.max_visits} визитов ({c.fillRate}%)
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: SA_COLOR }}>+{formatGeo(c.reward_amount)}</div>
              <div style={{ fontSize: 10, color: C.t3 }}>GEO/визит</div>
            </div>
          </div>
          {/* Fill bar */}
          <div style={{ background: C.b0, borderRadius: 4, height: 4, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ height: 4, borderRadius: 4, width: `${c.fillRate}%`, background: c.active ? '#10B981' : C.t3, transition: 'width 0.5s' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {c.active
              ? <Btn variant="danger" size="sm" onClick={() => toggle(c.id, true)} loading={busy[c.id]} style={{ flex: 1 }}>
                  <PauseCircle size={13} /> Force Stop
                </Btn>
              : <Btn variant="success" size="sm" onClick={() => toggle(c.id, false)} loading={busy[c.id]} style={{ flex: 1 }}>
                  <PlayCircle size={13} /> Запустить
                </Btn>
            }
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Finance ─────────────────────────────────────────────────────────────

function FinanceTab({ geoRate }) {
  const [wdFilter,  setWdFilter]  = useState('pending');
  const [wdList,    setWdList]    = useState([]);
  const [wdLoading, setWdLoading] = useState(true);
  const [rejectId,  setRejectId]  = useState(null);
  const [note,      setNote]      = useState('');
  const [busy,      setBusy]      = useState({});
  const [econ,      setEcon]      = useState(null);
  const [cfg,       setCfg]       = useState(null);
  const [rateInput, setRateInput] = useState('');
  const [rateNote,  setRateNote]  = useState('');
  const [rateLoading, setRateLoading] = useState(false);
  const [rateMsg,   setRateMsg]   = useState('');
  const [section,   setSection]   = useState('withdrawals');

  useEffect(() => {
    setWdLoading(true);
    const qs = wdFilter === 'all' ? '' : `?status=${wdFilter}`;
    saFetch(`/api/superadmin/withdrawals${qs}`)
      .then(d => setWdList(d.withdrawals || []))
      .catch(() => {})
      .finally(() => setWdLoading(false));
  }, [wdFilter]);

  useEffect(() => {
    Promise.all([saFetch('/api/superadmin/economics'), saFetch('/api/superadmin/platform-config')])
      .then(([e, c]) => { setEcon(e); setCfg(c); setRateInput(String(e.geoRate || 1000)); })
      .catch(() => {});
  }, []);

  async function approve(id) {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await saFetch(`/api/superadmin/withdrawals/${id}/approve`, { method: 'POST' });
      setWdList(l => l.map(w => w.id === id ? { ...w, status: 'approved' } : w));
    } catch (e) { alert(`Ошибка: ${e.message}`); }
    setBusy(b => ({ ...b, [id]: false }));
  }

  async function reject(id) {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await saFetch(`/api/superadmin/withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
      setWdList(l => l.map(w => w.id === id ? { ...w, status: 'rejected', note } : w));
      setRejectId(null); setNote('');
    } catch (e) { alert(`Ошибка: ${e.message}`); }
    setBusy(b => ({ ...b, [id]: false }));
  }

  async function saveRate() {
    const r = parseFloat(rateInput);
    if (!r || r <= 0) return setRateMsg('Введите корректный курс');
    setRateLoading(true);
    try {
      const res = await saFetch('/api/superadmin/config/rate', { method: 'POST', body: JSON.stringify({ rate: r, note: rateNote }) });
      setRateMsg(res.warning || `✓ Записано: 1 GEO = ${r} UZS`);
    } catch (e) { setRateMsg(`Ошибка: ${e.message}`); }
    setRateLoading(false);
  }

  const tabs = [
    { k: 'withdrawals', label: 'Выводы' },
    { k: 'economics',   label: 'Экономика' },
    { k: 'rate',        label: 'Курс GEO' },
  ];

  return (
    <div>
      {/* Section switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.k} onClick={() => setSection(t.k)} style={{
            flex: 1, padding: '9px 4px', borderRadius: 11, fontSize: 12, fontWeight: 700,
            border: `1.5px solid ${section === t.k ? SA_COLOR : C.b1}`,
            background: section === t.k ? `${SA_COLOR}18` : 'transparent',
            color: section === t.k ? SA_COLOR : C.t3, cursor: 'pointer',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Withdrawals ── */}
      {section === 'withdrawals' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[['pending','Ожидают'],['approved','Одобрены'],['rejected','Отклонены'],['all','Все']].map(([k, lbl]) => (
              <button key={k} onClick={() => setWdFilter(k)} style={{
                flex: 1, padding: '8px 2px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                border: `1.5px solid ${wdFilter === k ? C.blue : C.b1}`,
                background: wdFilter === k ? `${C.blue}18` : 'transparent',
                color: wdFilter === k ? C.blue : C.t3, cursor: 'pointer',
              }}>
                {lbl}
              </button>
            ))}
          </div>

          {wdLoading && [1,2].map(i => (
            <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '14px 16px', marginBottom: 10, borderRadius: 16 }}>
              <Skel h={14} w="60%" r={6} /><div style={{ marginTop: 8 }}><Skel h={10} w="40%" r={5} /></div>
            </div>
          ))}

          {!wdLoading && wdList.length === 0 && <Empty icon={ArrowDownToLine} text="Нет заявок" />}

          {!wdLoading && wdList.map(w => (
            <div key={w.id} style={{
              ...cardBase,
              border: `1px solid ${w.status === 'pending' ? `${C.gold}50` : C.b1}`,
              padding: '16px', marginBottom: 10, borderRadius: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 22, color: '#10B981', letterSpacing: -0.5 }}>
                    {formatGeo(w.amount)} GEO
                  </div>
                  <div style={{ fontSize: 12, color: C.t3 }}>≈ {formatUzs(geoToUzs(w.amount, geoRate))} UZS</div>
                </div>
                <StatusBadge status={w.status} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: w.status === 'pending' ? 12 : 0 }}>
                <div style={{ fontSize: 13, color: C.t2, display: 'flex', gap: 5, alignItems: 'center' }}>
                  <Smartphone size={12} color={C.t3} />
                  <span style={{ fontFamily: 'monospace', color: C.blue }}>{w.phone}</span>
                </div>
                <div style={{ fontSize: 12, color: C.t3, display: 'flex', gap: 5, alignItems: 'center' }}>
                  <User size={11} color={C.t3} />
                  {w.users?.username ? `@${w.users.username}` : `tg:${w.users?.telegram_id}`}
                  {w.users?.balance != null && <span> · остаток {formatGeo(w.users.balance)} GEO</span>}
                </div>
                <div style={{ fontSize: 11, color: C.t3, display: 'flex', gap: 5, alignItems: 'center' }}>
                  <Clock size={10} color={C.t3} /> {fmtDate(w.created_at)}
                  {w.processed_at && ` → ${fmtDate(w.processed_at)}`}
                </div>
                {w.note && <div style={{ fontSize: 12, color: C.orange, display: 'flex', gap: 5 }}><FileText size={11} color={C.orange} />{w.note}</div>}
              </div>
              {w.status === 'pending' && (
                rejectId === w.id ? (
                  <div>
                    <input
                      value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Причина отказа..."
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.red}60`, background: C.redFt, color: C.t1, fontSize: 14, outline: 'none', marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="ghost" size="sm" onClick={() => { setRejectId(null); setNote(''); }} style={{ flex: 1 }}>Отмена</Btn>
                      <Btn variant="danger" size="sm" onClick={() => reject(w.id)} loading={busy[w.id]} style={{ flex: 2 }}>
                        <XCircle size={14} /> Отклонить + вернуть GEO
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn variant="danger" size="sm" onClick={() => setRejectId(w.id)} style={{ flex: 1 }}>
                      <XCircle size={14} /> Отклонить
                    </Btn>
                    <Btn variant="success" size="sm" onClick={() => approve(w.id)} loading={busy[w.id]} style={{ flex: 2 }}>
                      <CheckCircle size={14} /> Одобрить (оплатить)
                    </Btn>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Economics ── */}
      {section === 'economics' && (
        <div>
          {!econ ? (
            <div>{[1,2,3].map(i => <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: 16, borderRadius: 16, marginBottom: 10 }}><Skel h={24} w="55%" r={8} /></div>)}</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Выручка (пополн.)', val: formatUzs(econ.totalRevenue) + ' UZS', color: '#10B981', Icon: DollarSign },
                  { label: 'Выплаты (выводы)',  val: formatUzs(econ.totalPayout)  + ' UZS', color: C.red,      Icon: ArrowDownToLine },
                  { label: 'GEO выдано',        val: formatGeo(econ.totalIssued)  + ' GEO', color: SA_COLOR,   Icon: Zap },
                  { label: 'Маржа',             val: formatUzs(econ.margin)       + ' UZS', color: econ.margin >= 0 ? '#10B981' : C.red, Icon: BarChart3 },
                ].map(c => (
                  <div key={c.label} style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px 12px', borderRadius: 16 }}>
                    <c.Icon size={18} color={c.color} strokeWidth={1.75} style={{ marginBottom: 6 }} />
                    <div style={{ fontSize: 18, fontWeight: 900, color: c.color, letterSpacing: -0.3 }}>{c.val}</div>
                    <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>{c.label}</div>
                  </div>
                ))}
              </div>

              {/* 7-day chart (text bars) */}
              <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '16px', borderRadius: 18 }}>
                <SectionTitle icon={BarChart3} color={C.t3}>7 дней — Выручка vs Выплаты</SectionTitle>
                {(econ.daily || []).map(day => {
                  const max = Math.max(...(econ.daily || []).map(d => Math.max(d.revenue, d.payout)), 1);
                  return (
                    <div key={day.date} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: C.t3 }}>
                        <span>{fmtDay(day.date)}</span>
                        <span style={{ color: '#10B981', fontWeight: 700 }}>+{formatUzs(day.revenue)}</span>
                        <span style={{ color: C.red,     fontWeight: 700 }}>-{formatUzs(day.payout)}</span>
                      </div>
                      <div style={{ background: C.b0, borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 3 }}>
                        <div style={{ height: 6, borderRadius: 4, width: `${Math.round(day.revenue / max * 100)}%`, background: '#10B981' }} />
                      </div>
                      <div style={{ background: C.b0, borderRadius: 4, height: 6, overflow: 'hidden' }}>
                        <div style={{ height: 6, borderRadius: 4, width: `${Math.round(day.payout / max * 100)}%`, background: C.red }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Rate config ── */}
      {section === 'rate' && (
        <div>
          <div style={{ ...cardBase, border: `1.5px solid ${SA_COLOR}40`, padding: '20px 16px', borderRadius: 18, marginBottom: 16 }}>
            <SectionTitle icon={Coins} color={SA_COLOR}>Курс GEO → UZS</SectionTitle>
            <div style={{ fontSize: 36, fontWeight: 900, color: SA_COLOR, letterSpacing: -1, marginBottom: 6 }}>
              {cfg?.geoRate || geoRate} <span style={{ fontSize: 16, color: C.t3 }}>UZS / GEO</span>
            </div>
            <div style={{ fontSize: 13, color: C.t3, marginBottom: 20 }}>
              Текущий курс из переменной <code style={{ background: C.b1, padding: '2px 6px', borderRadius: 5 }}>GEO_RATE</code> Railway
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Новый курс (UZS за 1 GEO)</div>
              <input
                value={rateInput}
                onChange={e => setRateInput(e.target.value)}
                placeholder="например: 1200"
                type="number"
                inputMode="numeric"
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${C.b2}`, background: C.card, color: C.t1, fontSize: 16, outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Комментарий</div>
              <input
                value={rateNote}
                onChange={e => setRateNote(e.target.value)}
                placeholder="Причина изменения..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${C.b2}`, background: C.card, color: C.t1, fontSize: 14, outline: 'none' }}
              />
            </div>
            {rateMsg && (
              <div style={{ fontSize: 13, color: rateMsg.startsWith('✓') ? '#10B981' : C.red, marginBottom: 12, fontWeight: 600 }}>
                {rateMsg}
              </div>
            )}
            <Btn variant="purple" size="lg" onClick={saveRate} loading={rateLoading}>
              Записать в историю изменений
            </Btn>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 10, lineHeight: 1.5 }}>
              ⚠ Чтобы изменение вступило в силу — обновите переменную <strong>GEO_RATE</strong> в Railway и перезапустите сервис.
            </div>
          </div>

          {/* Rate history */}
          {cfg?.rateHistory?.length > 0 && (
            <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '16px', borderRadius: 18 }}>
              <SectionTitle icon={Clock} color={C.t3}>История изменений</SectionTitle>
              {cfg.rateHistory.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < cfg.rateHistory.length - 1 ? `1px solid ${C.b0}` : 'none' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: SA_COLOR }}>{r.rate} UZS/GEO</div>
                    <div style={{ fontSize: 11, color: C.t3 }}>{r.note || '—'}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.t3, textAlign: 'right' }}>{fmtDate(r.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Users ───────────────────────────────────────────────────────────────

function UsersTab() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [card,    setCard]    = useState(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [adjustAmt,   setAdjustAmt]  = useState('');
  const [adjustNote,  setAdjustNote] = useState('');
  const [busy,        setBusy]       = useState({});
  const [msg,         setMsg]        = useState('');

  useEffect(() => {
    saFetch('/api/superadmin/users')
      .then(d => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function openCard(u) {
    setCard(null); setMsg(''); setAdjustAmt(''); setAdjustNote('');
    setCardLoading(true);
    try {
      const d = await saFetch(`/api/superadmin/users/${u.id}/card`);
      setCard(d);
    } catch { setCard({ user: u, recentVisits: [], recentWithdrawals: [] }); }
    setCardLoading(false);
  }

  async function ban(userId) {
    if (!confirm('Заблокировать пользователя?')) return;
    setBusy(b => ({ ...b, ban: true }));
    try {
      await saFetch(`/api/superadmin/users/${userId}/ban`, { method: 'POST', body: JSON.stringify({ reason: 'Admin action' }) });
      setUsers(us => us.map(u => u.id === userId ? { ...u, banned_at: new Date().toISOString() } : u));
      if (card?.user?.id === userId) setCard(c => ({ ...c, user: { ...c.user, banned_at: new Date().toISOString() } }));
      setMsg('Пользователь заблокирован');
    } catch (e) { setMsg(`Ошибка: ${e.detail || e.message}`); }
    setBusy(b => ({ ...b, ban: false }));
  }

  async function unban(userId) {
    setBusy(b => ({ ...b, ban: true }));
    try {
      await saFetch(`/api/superadmin/users/${userId}/unban`, { method: 'POST' });
      setUsers(us => us.map(u => u.id === userId ? { ...u, banned_at: null } : u));
      if (card?.user?.id === userId) setCard(c => ({ ...c, user: { ...c.user, banned_at: null } }));
      setMsg('Пользователь разблокирован');
    } catch (e) { setMsg(`Ошибка: ${e.detail || e.message}`); }
    setBusy(b => ({ ...b, ban: false }));
  }

  async function adjust(userId, sign) {
    const amt = parseFloat(adjustAmt) * sign;
    if (!amt || !adjustNote.trim()) return setMsg('Введите сумму и комментарий');
    setBusy(b => ({ ...b, adjust: true }));
    try {
      const res = await saFetch(`/api/superadmin/users/${userId}/adjust`, { method: 'POST', body: JSON.stringify({ amount: amt, note: adjustNote }) });
      setCard(c => c ? { ...c, user: { ...c.user, balance: res.newBalance } } : c);
      setUsers(us => us.map(u => u.id === userId ? { ...u, balance: res.newBalance } : u));
      setMsg(`✓ Баланс обновлён: ${formatGeo(res.newBalance)} GEO`);
      setAdjustAmt(''); setAdjustNote('');
    } catch (e) { setMsg(`Ошибка: ${e.detail || e.message}`); }
    setBusy(b => ({ ...b, adjust: false }));
  }

  const q = search.toLowerCase();
  const filtered = q
    ? users.filter(u => u.username?.toLowerCase().includes(q) || String(u.telegram_id).includes(q))
    : users;

  return (
    <div>
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Поиск @username или Telegram ID..."
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${C.b2}`, background: C.card, color: C.t1, fontSize: 14, outline: 'none', marginBottom: 12, WebkitAppearance: 'none' }}
      />

      {loading && [1,2,3,4,5].map(i => (
        <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '12px 16px', marginBottom: 8, borderRadius: 14, display: 'flex', justifyContent: 'space-between' }}>
          <Skel h={14} w={140} r={6} /><Skel h={18} w={80} r={6} />
        </div>
      ))}

      {!loading && filtered.length === 0 && <Empty icon={Users} text="Нет пользователей" />}

      {!loading && filtered.map((u, i) => (
        <div key={u.id} style={{
          ...cardBase,
          border: `1px solid ${u.banned_at ? `${C.red}40` : C.b1}`,
          padding: '12px 16px', marginBottom: 8, borderRadius: 14,
          background: u.banned_at ? `${C.red}06` : C.card,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          animation: `fadeUp 0.3s ${i * 0.03}s ease both`,
          cursor: 'pointer',
        }}
        onClick={() => openCard(u)}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.t1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {u.username ? `@${u.username}` : `ID ${u.telegram_id}`}
              {u.banned_at && <Badge label="БАН" color={C.red} />}
            </div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
              {u.visit_count} визитов · {fmtDate(u.created_at).split(',')[0]}
            </div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: u.balance > 0 ? '#10B981' : C.t3 }}>{formatGeo(u.balance)}</div>
              <div style={{ fontSize: 10, color: C.t3 }}>GEO</div>
            </div>
            <ChevronRight size={14} color={C.t3} />
          </div>
        </div>
      ))}

      {/* User card modal */}
      {(card || cardLoading) && (
        <>
          <div onClick={() => setCard(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
            background: '#0D1117', borderRadius: '28px 28px 0 0',
            border: `1px solid rgba(255,255,255,0.08)`, borderBottom: 'none',
            padding: '0 0 40px', maxWidth: 480, margin: '0 auto',
            animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
            maxHeight: '85vh', overflowY: 'auto',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 20px' }} />
            <div style={{ padding: '0 20px' }}>
              {cardLoading ? (
                <><Skel h={24} w="50%" r={8} /><div style={{ marginTop: 12 }}><Skel h={16} w="70%" r={6} /></div></>
              ) : card && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 800, fontSize: 22, color: C.t1, marginBottom: 4 }}>
                      {card.user.username ? `@${card.user.username}` : `ID ${card.user.telegram_id}`}
                      {card.user.banned_at && <Badge label=" БАН" color={C.red} />}
                    </div>
                    <div style={{ fontSize: 13, color: C.t3 }}>tg: {card.user.telegram_id} · с {fmtDate(card.user.created_at).split(',')[0]}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#10B981', marginTop: 8 }}>
                      {formatGeo(card.user.balance)} <span style={{ fontSize: 14, color: C.t3, fontWeight: 500 }}>GEO</span>
                    </div>
                  </div>

                  {/* Recent visits */}
                  {card.recentVisits.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <SectionTitle icon={MapPin} color={C.t3}>Последние визиты</SectionTitle>
                      {card.recentVisits.slice(0, 5).map(v => (
                        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.b0}` }}>
                          <div style={{ fontSize: 13, color: C.t2 }}>{v.business_name || '—'}</div>
                          <div style={{ fontSize: 13, color: '#10B981', fontWeight: 700 }}>+{formatGeo(v.rewarded)} GEO</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manual GEO adjust */}
                  <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px', borderRadius: 14, marginBottom: 14 }}>
                    <SectionTitle icon={Coins} color={C.gold}>Ручная корректировка GEO</SectionTitle>
                    <input
                      value={adjustAmt} onChange={e => setAdjustAmt(e.target.value)}
                      placeholder="Сумма GEO" type="number" inputMode="numeric"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.b2}`, background: C.card, color: C.t1, fontSize: 14, outline: 'none', marginBottom: 8 }}
                    />
                    <input
                      value={adjustNote} onChange={e => setAdjustNote(e.target.value)}
                      placeholder="Обязательный комментарий..."
                      style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.b2}`, background: C.card, color: C.t1, fontSize: 14, outline: 'none', marginBottom: 10 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="success" size="sm" onClick={() => adjust(card.user.id, +1)} loading={busy.adjust} style={{ flex: 1 }}>
                        <Plus size={13} /> Начислить
                      </Btn>
                      <Btn variant="danger" size="sm" onClick={() => adjust(card.user.id, -1)} loading={busy.adjust} style={{ flex: 1 }}>
                        <Minus size={13} /> Списать
                      </Btn>
                    </div>
                  </div>

                  {msg && (
                    <div style={{ fontSize: 13, color: msg.startsWith('✓') ? '#10B981' : C.red, fontWeight: 600, marginBottom: 12 }}>{msg}</div>
                  )}

                  {/* Ban/unban */}
                  {card.user.banned_at
                    ? <Btn variant="success" size="lg" onClick={() => unban(card.user.id)} loading={busy.ban}><UserCheck size={16} /> Разблокировать</Btn>
                    : <Btn variant="danger"  size="lg" onClick={() => ban(card.user.id)}   loading={busy.ban}><Ban size={16} /> Заблокировать</Btn>
                  }
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: System ──────────────────────────────────────────────────────────────

function SystemTab() {
  const [cfg,     setCfg]     = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [auditWarn, setAuditWarn] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      saFetch('/api/superadmin/platform-config'),
      saFetch('/api/superadmin/audit-log'),
    ])
      .then(([c, a]) => {
        setCfg(c);
        setAuditLog(a.log || []);
        if (a.warning) setAuditWarn(a.warning);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const actionColors = {
    user_ban:           C.red,
    user_unban:         '#10B981',
    geo_credit:         '#10B981',
    geo_debit:          C.orange,
    business_suspend:   C.red,
    business_unsuspend: '#10B981',
    rate_change:        SA_COLOR,
  };

  return (
    <div>
      {/* Config */}
      <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '18px', borderRadius: 18, marginBottom: 16 }}>
        <SectionTitle icon={Settings} color={C.t3}>Конфигурация платформы</SectionTitle>
        {loading
          ? <><Skel h={14} w="60%" r={6} /><div style={{ marginTop: 8 }}><Skel h={14} w="45%" r={6} /></div></>
          : cfg && [
              ['GEO Rate (env)',  `${cfg.geoRate} UZS / GEO`],
              ['Topup Card',      cfg.topupCard || '—'],
              ['Topup Bank',      cfg.topupBank || '—'],
              ['Super Admin ID',  String(SA_ID)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.b0}` }}>
                <span style={{ fontSize: 12, color: C.t3 }}>{k}</span>
                <code style={{ fontSize: 13, color: C.t1, background: C.b1, padding: '2px 8px', borderRadius: 6 }}>{v}</code>
              </div>
            ))
        }
      </div>

      {/* Audit log */}
      <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '18px', borderRadius: 18 }}>
        <SectionTitle icon={FileText} color={C.t3}>
          Audit Log {auditWarn ? '(недоступен)' : `(${auditLog.length})`}
        </SectionTitle>
        {auditWarn && (
          <div style={{ fontSize: 12, color: C.orange, background: `${C.orange}10`, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            ⚠ {auditWarn}. Создайте таблицу <code>sa_audit_log</code> в Supabase.
          </div>
        )}
        {loading && [1,2,3].map(i => <div key={i} style={{ marginBottom: 10 }}><Skel h={14} w="70%" r={6} /></div>)}
        {!loading && auditLog.length === 0 && !auditWarn && <Empty icon={FileText} text="Лог пуст" />}
        {!loading && auditLog.map((entry, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${C.b0}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: actionColors[entry.action] || C.t1, marginBottom: 2 }}>
                {entry.action}
              </div>
              {entry.note && <div style={{ fontSize: 11, color: C.t3 }}>{entry.note}</div>}
              {entry.target_id && <div style={{ fontSize: 11, color: C.t3 }}>ID: {entry.target_id}</div>}
            </div>
            <div style={{ fontSize: 11, color: C.t3, flexShrink: 0, marginLeft: 10 }}>{fmtDate(entry.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── useGeoRate ───────────────────────────────────────────────────────────────

function useGeoRate() {
  const [rate, setRate] = useState(1000);
  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then(r => r.ok ? r.json() : { geoRate: 1000 })
      .then(d => { if (d.geoRate) setRate(d.geoRate); })
      .catch(() => {});
  }, []);
  return rate;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'overview',   label: 'Обзор',    Icon: LayoutDashboard },
  { key: 'fraud',      label: 'Фрод',     Icon: ShieldAlert     },
  { key: 'businesses', label: 'Бизнесы',  Icon: Store           },
  { key: 'campaigns',  label: 'Кампании', Icon: Megaphone       },
  { key: 'finance',    label: 'Финансы',  Icon: Wallet          },
  { key: 'users',      label: 'Юзеры',    Icon: Users           },
  { key: 'system',     label: 'Система',  Icon: Settings        },
];

export default function SuperAdmin() {
  const [tab, setTab] = useState('overview');
  const geoRate = useGeoRate();

  if (!isSA) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,59,92,0.08)', border: `1.5px solid rgba(255,59,92,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
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
      <div style={{ background: 'linear-gradient(160deg, #0A0510 0%, #170A28 60%, #0A0510 100%)', padding: '32px 20px 52px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle, ${SA_COLOR}20 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={12} color={SA_COLOR} /> Super Admin · God View
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.t1, letterSpacing: -0.5, marginBottom: 4 }}>GeoEarn Platform</div>
        <div style={{ fontSize: 13, color: C.t3 }}>ID {SA_ID} · Полный доступ</div>
      </div>

      {/* Tab bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,9,14,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.b1}`, marginTop: -24,
        display: 'flex', overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: '0 0 auto', padding: '14px 14px',
            background: 'none', border: 'none',
            borderBottom: `2.5px solid ${tab === t.key ? SA_COLOR : 'transparent'}`,
            color: tab === t.key ? SA_COLOR : C.t3,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <t.Icon size={13} color={tab === t.key ? SA_COLOR : C.t3} strokeWidth={tab === t.key ? 2.5 : 1.75} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 16px 100px' }}>
        {tab === 'overview'   && <OverviewTab />}
        {tab === 'fraud'      && <FraudTab />}
        {tab === 'businesses' && <BusinessesTab />}
        {tab === 'campaigns'  && <CampaignsTab />}
        {tab === 'finance'    && <FinanceTab geoRate={geoRate} />}
        {tab === 'users'      && <UsersTab />}
        {tab === 'system'     && <SystemTab />}
      </div>
    </div>
  );
}
