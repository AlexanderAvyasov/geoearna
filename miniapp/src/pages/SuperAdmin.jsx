import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, ShieldAlert, Store, Megaphone, Wallet, Users, Settings,
  TrendingUp, TrendingDown, Bell, AlertTriangle, CheckCircle, XCircle,
  Loader2, Clock, User, Smartphone, FileText, MapPin, Lock, Shield, CreditCard,
  RefreshCw, Search, Zap, Activity, BarChart3, DollarSign,
  ChevronRight, Plus, Minus, Ban, UserCheck, PauseCircle, PlayCircle,
  ArrowDownToLine, Coins, Star, Trophy, Target, Trash2, Pencil, Check, X, QrCode, Send,
  MessageCircle, AlertCircle, MessageCircleReply,
} from 'lucide-react';
import { API_BASE, waitForInitData, apiFetch } from '../lib/api';
import { formatGeo, formatUzs, geoToUzs } from '../lib/geo';
import { C, G, cardBase } from '../lib/design';

// ─── constants ────────────────────────────────────────────────────────────────

const SA_COLOR = '#A050FF';

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
  const initdata = await waitForInitData();
  const r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { initdata, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error || 'API_ERROR'), { detail: data.detail });
  return data;
}

// ─── shared components ────────────────────────────────────────────────────────

function Skel({ h = 16, w = '100%', r = 8 }) {
  return <div className="sk" style={{ height: h, width: w, borderRadius: r }} />;
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

// ─── Wallet history section ───────────────────────────────────────────────────

const WALLET_TX_STYLE = {
  commission: { color: '#10B981', bg: '#10B98114', border: '#10B98130', sign: '+', Icon: Coins,           label: 'Комиссия'  },
  withdrawal: { color: C.red,    bg: C.redFt,     border: `${C.red}30`, sign: '−', Icon: ArrowDownToLine, label: 'Вывод'     },
  promo:      { color: '#3B82F6', bg: '#3B82F614', border: '#3B82F630', sign: '−', Icon: QrCode,          label: 'Promo QR'  },
  geohunt:    { color: '#FF8C00', bg: '#FF8C0014', border: '#FF8C0030', sign: '−', Icon: Target,          label: 'GeoHunt'   },
};

function WalletHistorySection() {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);

  function load() {
    setLoading(true);
    saFetch('/api/superadmin/platform-wallet/history')
      .then(d => setHistory(d.history || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }

  function toggle() {
    if (!open && history === null) load();
    setOpen(o => !o);
  }

  return (
    <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px 16px', borderRadius: 18, marginBottom: 16 }}>
      <button
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <SectionTitle icon={Activity} color={C.t3}>История операций кошелька</SectionTitle>
        <ChevronRight size={14} color={C.t3} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <Loader2 size={22} color={C.t3} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}

          {!loading && (history || []).length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: C.t3 }}>
              Операций пока нет
            </div>
          )}

          {!loading && (history || []).map((tx, i) => {
            const s = WALLET_TX_STYLE[tx.type] || WALLET_TX_STYLE.commission;
            return (
              <div key={tx.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 0',
                borderBottom: i < history.length - 1 ? `1px solid ${C.b0}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: s.bg, border: `1px solid ${s.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <s.Icon size={14} color={s.color} strokeWidth={1.75} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                      {tx.label}
                    </div>
                    <div style={{ fontSize: 11, color: C.t3, marginTop: 1 }}>{fmtDate(tx.created_at)}</div>
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: s.color, letterSpacing: -0.3 }}>
                    {s.sign}{formatGeo(tx.amount)} GEO
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && (history || []).length > 0 && (
            <Btn variant="ghost" size="sm" onClick={load} loading={loading} style={{ width: '100%', marginTop: 10 }}>
              <RefreshCw size={12} /> Обновить
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  function load() {
    setLoading(true);
    setErr('');
    saFetch('/api/superadmin/overview')
      .then(d => setData(d))
      .catch(e => setErr(e.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const d = data || {};

  return (
    <div>
      {/* Error banner */}
      {!loading && err && (
        <div style={{
          background: C.redFt, border: `1.5px solid ${C.red}30`,
          borderRadius: 14, padding: '12px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertTriangle size={18} color={C.red} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: C.red, fontWeight: 600 }}>
            Ошибка: {err}
          </div>
          <Btn variant="ghost" size="sm" onClick={load}>Повторить</Btn>
        </div>
      )}

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

      <WalletHistorySection />

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

// ─── PlatformCampaignSheet ────────────────────────────────────────────────────

function PlatformCampaignSheet({ onClose, onCreated }) {
  const [businesses,  setBusinesses]  = useState([]);
  const [bizLoading,  setBizLoading]  = useState(true);
  const [bizId,       setBizId]       = useState('');
  const [reward,      setReward]      = useState('');
  const [visits,      setVisits]      = useState('');
  const [endsAt,      setEndsAt]      = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [result,      setResult]      = useState(null);
  const [walletBal,   setWalletBal]   = useState(null);

  useEffect(() => {
    Promise.all([
      saFetch('/api/superadmin/businesses').then(d => setBusinesses(d.businesses || [])).catch(() => {}),
      saFetch('/api/superadmin/overview').then(d => setWalletBal(d.platformBalance)).catch(() => {}),
    ]).finally(() => setBizLoading(false));
  }, []);

  const rewardNum  = parseInt(reward, 10)  || 0;
  const visitsNum  = parseInt(visits, 10)  || 0;
  const totalCost  = rewardNum * visitsNum;
  const canAfford  = walletBal !== null && totalCost <= walletBal && totalCost > 0;
  const canSubmit  = bizId && rewardNum >= 1 && visitsNum >= 1 && canAfford;
  const today      = new Date().toISOString().split('T')[0];

  async function handleCreate() {
    if (!canSubmit) return;
    setLoading(true); setError('');
    try {
      const d = await saFetch('/api/superadmin/platform-campaign', {
        method: 'POST',
        body: JSON.stringify({
          business_id:  parseInt(bizId, 10),
          reward_amount: rewardNum,
          max_visits:    visitsNum,
          ends_at:       endsAt ? new Date(endsAt + 'T23:59:59').toISOString() : null,
        }),
      });
      setResult(d);
      onCreated && onCreated();
    } catch (e) {
      setError(e.message === 'INSUFFICIENT_PLATFORM_BALANCE' ? 'Недостаточно на кошельке платформы.' : `Ошибка: ${e.message}`);
    } finally { setLoading(false); }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 400, animation: 'backdropIn 0.22s ease' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
        background: C.surf, borderRadius: '24px 24px 0 0',
        border: `1px solid ${C.b2}`, borderBottom: 'none',
        maxWidth: 480, margin: '0 auto', maxHeight: '90vh', overflowY: 'auto',
        animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)', padding: '0 0 44px',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 20px' }} />
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4, color: C.t1 }}>Акция платформы</div>
          <div style={{ fontSize: 13, color: C.t3, marginBottom: 20 }}>
            Кошелёк: <strong style={{ color: SA_COLOR }}>{walletBal !== null ? formatGeo(walletBal) : '...'} GEO</strong>
          </div>

          {result ? (
            <div>
              <div style={{ background: `#10B98115`, border: `1px solid #10B98140`, borderRadius: 16, padding: '20px', marginBottom: 20, textAlign: 'center' }}>
                <CheckCircle size={32} color="#10B981" style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 800, fontSize: 16, color: C.t1, marginBottom: 8 }}>Акция создана!</div>
                <div style={{ fontSize: 13, color: C.t3, marginBottom: 16 }}>{result.business?.name}</div>
                <div style={{ background: C.card, border: `1px solid ${C.b1}`, borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.t3, marginBottom: 6 }}>QR-ссылка для чекина</div>
                  <div style={{ fontSize: 12, color: SA_COLOR, wordBreak: 'break-all', fontFamily: 'monospace' }}>{result.qrUrl}</div>
                </div>
                {result.qrUrl && (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=1&bgcolor=ffffff&color=000000&data=${encodeURIComponent(result.qrUrl)}`}
                    alt="QR" style={{ width: 140, height: 140, borderRadius: 8, border: `1px solid ${C.b1}` }}
                  />
                )}
              </div>
              <Btn variant="ghost" size="lg" onClick={onClose}>Закрыть</Btn>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>Заведение</div>
                {bizLoading
                  ? <Skel h={44} r={12} />
                  : <select
                      value={bizId}
                      onChange={e => setBizId(e.target.value)}
                      style={{
                        width: '100%', background: C.card, border: `1px solid ${C.b1}`,
                        borderRadius: 12, padding: '12px 14px', fontSize: 14,
                        color: bizId ? C.t1 : C.t3, outline: 'none', boxSizing: 'border-box',
                      }}>
                      <option value="">Выберите заведение...</option>
                      {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                }
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>Награда (GEO)</div>
                  <input value={reward} onChange={e => setReward(e.target.value.replace(/\D/g, ''))}
                    placeholder="100" inputMode="numeric"
                    style={{ width: '100%', background: C.card, border: `1px solid ${C.b1}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, color: C.t1, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>Активаций</div>
                  <input value={visits} onChange={e => setVisits(e.target.value.replace(/\D/g, ''))}
                    placeholder="50" inputMode="numeric"
                    style={{ width: '100%', background: C.card, border: `1px solid ${C.b1}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, color: C.t1, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              {rewardNum > 0 && visitsNum > 0 && (
                <div style={{
                  background: canAfford ? `${SA_COLOR}10` : C.redFt,
                  border: `1px solid ${canAfford ? `${SA_COLOR}40` : 'rgba(255,59,92,0.25)'}`,
                  borderRadius: 12, padding: '12px 14px', marginBottom: 14,
                  fontSize: 13, fontWeight: 700, color: canAfford ? SA_COLOR : C.red,
                }}>
                  Итого: {formatGeo(totalCost)} GEO
                  {!canAfford && walletBal !== null && ` (доступно: ${formatGeo(walletBal)})`}
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>Дата окончания (необязательно)</div>
                <input type="date" value={endsAt} min={today}
                  onChange={e => setEndsAt(e.target.value)}
                  style={{ width: '100%', background: C.card, border: `1px solid ${C.b1}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, color: C.t1, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box' }} />
              </div>

              {error && (
                <div style={{ background: C.redFt, border: `1px solid rgba(255,59,92,0.2)`, borderRadius: 12, padding: '10px 14px', fontSize: 13, color: C.red, fontWeight: 700, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <Btn variant="purple" size="lg" onClick={handleCreate} loading={loading} disabled={!canSubmit}>
                <Zap size={15} />
                {canSubmit ? `Создать акцию · ${formatGeo(totalCost)} GEO` : 'Заполните форму'}
              </Btn>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── CampaignSAEditSheet ──────────────────────────────────────────────────────

function CampaignSAEditSheet({ campaign, onClose, onSaved }) {
  const [reward,   setReward]   = useState(String(campaign.reward_amount));
  const [visits,   setVisits]   = useState(String(campaign.max_visits));
  const [endsAt,   setEndsAt]   = useState(campaign.ends_at ? new Date(campaign.ends_at).toISOString().split('T')[0] : '');
  const [noEnd,    setNoEnd]    = useState(!campaign.ends_at);
  const [active,   setActive]   = useState(campaign.active);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const today = new Date().toISOString().split('T')[0];

  async function handleSave() {
    setLoading(true); setError('');
    try {
      const body = {
        reward_amount: parseInt(reward, 10) || campaign.reward_amount,
        max_visits:    parseInt(visits, 10) || campaign.max_visits,
        active,
        ends_at: noEnd ? null : (endsAt ? new Date(endsAt + 'T23:59:59').toISOString() : campaign.ends_at),
      };
      await saFetch(`/api/superadmin/campaigns/${campaign.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      onSaved();
    } catch (e) {
      setError(`Ошибка: ${e.message}`);
    } finally { setLoading(false); }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 400, animation: 'backdropIn 0.22s ease' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
        background: C.surf, borderRadius: '24px 24px 0 0',
        border: `1px solid ${C.b2}`, borderBottom: 'none',
        maxWidth: 480, margin: '0 auto', maxHeight: '85vh', overflowY: 'auto',
        animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)', padding: '0 0 44px',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 20px' }} />
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4, color: C.t1 }}>Редактировать кампанию</div>
          <div style={{ fontSize: 13, color: C.t3, marginBottom: 20 }}>{campaign.business_name} · ID {campaign.id}</div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>Награда (GEO)</div>
              <input value={reward} onChange={e => setReward(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
                style={{ width: '100%', background: C.card, border: `1px solid ${C.b1}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, color: C.t1, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>Активаций</div>
              <input value={visits} onChange={e => setVisits(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
                style={{ width: '100%', background: C.card, border: `1px solid ${C.b1}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, color: C.t1, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>Дата окончания</div>
            <div onClick={() => setNoEnd(v => !v)} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: C.card, border: `1px solid ${C.b0}`, borderRadius: 12, padding: '10px 14px', marginBottom: 8, cursor: 'pointer',
            }}>
              <span style={{ fontSize: 14, color: C.t2 }}>Без ограничения</span>
              <div style={{
                width: 40, height: 22, borderRadius: 11,
                background: noEnd ? SA_COLOR : C.b2, transition: 'background 0.2s',
                position: 'relative', flexShrink: 0,
              }}>
                <div style={{ position: 'absolute', top: 3, left: noEnd ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </div>
            </div>
            {!noEnd && (
              <input type="date" value={endsAt} min={today}
                onChange={e => setEndsAt(e.target.value)}
                style={{ width: '100%', background: C.card, border: `1px solid ${C.b1}`, borderRadius: 12, padding: '12px 14px', fontSize: 14, color: C.t1, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box' }} />
            )}
          </div>

          <div onClick={() => setActive(v => !v)} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: active ? `#10B98110` : C.card,
            border: `1px solid ${active ? '#10B98140' : C.b0}`,
            borderRadius: 12, padding: '12px 14px', marginBottom: 20, cursor: 'pointer',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: active ? '#10B981' : C.t2 }}>
              {active ? 'Активна' : 'Остановлена'}
            </span>
            <div style={{
              width: 40, height: 22, borderRadius: 11,
              background: active ? '#10B981' : C.b2, transition: 'background 0.2s',
              position: 'relative', flexShrink: 0,
            }}>
              <div style={{ position: 'absolute', top: 3, left: active ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
          </div>

          {error && (
            <div style={{ background: C.redFt, border: `1px solid rgba(255,59,92,0.2)`, borderRadius: 12, padding: '10px 14px', fontSize: 13, color: C.red, fontWeight: 700, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" size="md" onClick={onClose} style={{ flex: 1 }}>Отмена</Btn>
            <Btn variant="purple" size="md" onClick={handleSave} loading={loading} style={{ flex: 2 }}>
              <Check size={14} /> Сохранить
            </Btn>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tab: Campaigns ───────────────────────────────────────────────────────────

function CampaignsTab() {
  const [campaigns,    setCampaigns]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('all');
  const [busy,         setBusy]         = useState({});
  const [fetchErr,     setFetchErr]     = useState(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [editCampaign, setEditCampaign] = useState(null);

  function load() {
    setLoading(true);
    setFetchErr(null);
    saFetch('/api/superadmin/campaigns')
      .then(d => setCampaigns(d.campaigns || []))
      .catch(e => setFetchErr(e.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

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
      {/* Create promo button */}
      <Btn variant="purple" size="md" onClick={() => setShowCreate(true)} style={{ width: '100%', marginBottom: 14 }}>
        <Plus size={15} /> Создать акцию платформы
      </Btn>

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

      {!loading && fetchErr && (
        <div style={{ background: `${C.red}10`, border: `1.5px solid ${C.red}30`, borderRadius: 14, padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 10 }}>
          <AlertTriangle size={18} color={C.red} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: C.red }}>{fetchErr}</div>
        </div>
      )}

      {!loading && !fetchErr && filtered.length === 0 && <Empty icon={Megaphone} text="Нет кампаний" />}

      {!loading && !fetchErr && filtered.map((c, i) => (
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
                {c.ends_at && ` · до ${fmtDay(c.ends_at)}`}
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
            <Btn variant="ghost" size="sm" onClick={() => setEditCampaign(c)} style={{ flex: 1 }}>
              <Pencil size={12} /> Изменить
            </Btn>
            {c.active
              ? <Btn variant="danger" size="sm" onClick={() => toggle(c.id, true)} loading={busy[c.id]} style={{ flex: 1 }}>
                  <PauseCircle size={13} /> Стоп
                </Btn>
              : <Btn variant="success" size="sm" onClick={() => toggle(c.id, false)} loading={busy[c.id]} style={{ flex: 1 }}>
                  <PlayCircle size={13} /> Запустить
                </Btn>
            }
          </div>
        </div>
      ))}

      {showCreate && (
        <PlatformCampaignSheet
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
      {editCampaign && (
        <CampaignSAEditSheet
          campaign={editCampaign}
          onClose={() => setEditCampaign(null)}
          onSaved={() => { setEditCampaign(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Tab: Finance ─────────────────────────────────────────────────────────────

function WithdrawalSheet({ w, geoRate, onClose, onApprove, onReject, busy }) {
  const [note,     setNote]     = useState('');
  const [rejecting, setRejecting] = useState(false);

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        zIndex: 300, animation: 'backdropIn 0.22s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.surf, borderRadius: '24px 24px 0 0',
        border: `1px solid ${C.b2}`, borderBottom: 'none',
        padding: '0 0 40px', zIndex: 301,
        maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 20px' }} />
        <div style={{ padding: '0 20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#10B981', letterSpacing: -0.5 }}>
                {formatGeo(w.amount)} GEO
              </div>
              <div style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>
                ≈ {formatUzs(geoToUzs(w.amount, geoRate))} UZS
              </div>
            </div>
            <StatusBadge status={w.status} />
          </div>

          {/* Details */}
          <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px 16px', borderRadius: 14, marginBottom: 16 }}>
            {[
              [CreditCard, 'Карта', w.phone, C.blue],
              [User,       'Пользователь', w.users?.username ? `@${w.users.username}` : `ID ${w.users?.telegram_id}`, C.t2],
              [Wallet,     'Остаток', w.users?.balance != null ? `${formatGeo(w.users.balance)} GEO` : '—', C.t2],
              [Clock,      'Дата заявки', fmtDate(w.created_at), C.t3],
              ...(w.processed_at ? [[CheckCircle, 'Обработано', fmtDate(w.processed_at), C.t3]] : []),
              ...(w.note ? [[FileText, 'Причина отказа', w.note, C.orange]] : []),
            ].map(([Icon, label, val, color], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: i < 2 ? `1px solid ${C.b0}` : 'none' }}>
                <Icon size={14} color={C.t3} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.t3, flexShrink: 0, minWidth: 90 }}>{label}</span>
                <span style={{ fontSize: 13, color, fontWeight: 600, wordBreak: 'break-all' }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          {w.status === 'pending' && (
            rejecting ? (
              <div>
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Причина отказа (необязательно)..."
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '12px 14px', borderRadius: 12,
                    border: `1.5px solid ${C.red}60`,
                    background: C.redFt, color: C.t1,
                    fontSize: 14, outline: 'none', marginBottom: 10,
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="ghost" size="md" onClick={() => { setRejecting(false); setNote(''); }} style={{ flex: 1 }}>
                    Отмена
                  </Btn>
                  <Btn variant="danger" size="md" onClick={() => onReject(w.id, note)} loading={busy} style={{ flex: 2 }}>
                    <XCircle size={16} /> Отклонить
                  </Btn>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="danger" size="md" onClick={() => setRejecting(true)} style={{ flex: 1 }}>
                  <XCircle size={16} /> Отклонить
                </Btn>
                <Btn variant="success" size="md" onClick={() => onApprove(w.id)} loading={busy} style={{ flex: 2 }}>
                  <CheckCircle size={16} /> Одобрить
                </Btn>
              </div>
            )
          )}

          {w.status !== 'pending' && (
            <Btn variant="ghost" size="md" onClick={onClose} style={{ width: '100%' }}>
              Закрыть
            </Btn>
          )}
        </div>
      </div>
    </>
  );
}

function FinanceTab({ geoRate }) {
  const [wdFilter,  setWdFilter]  = useState('pending');
  const [wdList,    setWdList]    = useState([]);
  const [wdLoading, setWdLoading] = useState(true);
  const [wdError,   setWdError]   = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [busy,      setBusy]      = useState(false);
  const [econ,      setEcon]      = useState(null);
  const [cfg,       setCfg]       = useState(null);
  const [rateInput, setRateInput] = useState('');
  const [rateNote,  setRateNote]  = useState('');
  const [rateLoading, setRateLoading] = useState(false);
  const [rateMsg,   setRateMsg]   = useState('');
  const [section,   setSection]   = useState('withdrawals');

  useEffect(() => {
    setWdLoading(true);
    setWdError(null);
    const qs = wdFilter === 'all' ? '' : `?status=${wdFilter}`;
    saFetch(`/api/superadmin/withdrawals${qs}`)
      .then(d => setWdList(d.withdrawals || []))
      .catch(e => setWdError(e.message || 'Ошибка загрузки'))
      .finally(() => setWdLoading(false));
  }, [wdFilter]);

  useEffect(() => {
    Promise.all([saFetch('/api/superadmin/economics'), saFetch('/api/superadmin/platform-config')])
      .then(([e, c]) => { setEcon(e); setCfg(c); setRateInput(String(e.geoRate || 1000)); })
      .catch(() => {});
  }, []);

  async function approve(id) {
    setBusy(true);
    try {
      await saFetch(`/api/superadmin/withdrawals/${id}/approve`, { method: 'POST' });
      setWdList(l => l.map(w => w.id === id ? { ...w, status: 'approved' } : w));
      setSelected(prev => prev ? { ...prev, status: 'approved' } : null);
    } catch (e) { alert(`Ошибка: ${e.message}`); }
    setBusy(false);
  }

  async function reject(id, note) {
    setBusy(true);
    try {
      await saFetch(`/api/superadmin/withdrawals/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
      setWdList(l => l.map(w => w.id === id ? { ...w, status: 'rejected', note } : w));
      setSelected(null);
    } catch (e) { alert(`Ошибка: ${e.message}`); }
    setBusy(false);
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

          {!wdLoading && wdError && (
            <div style={{ background: `${C.red}10`, border: `1.5px solid ${C.red}30`, borderRadius: 14, padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 10 }}>
              <AlertTriangle size={18} color={C.red} style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 13, color: C.red }}>{wdError}</div>
            </div>
          )}

          {!wdLoading && !wdError && wdList.length === 0 && <Empty icon={ArrowDownToLine} text="Нет заявок" />}

          {!wdLoading && !wdError && wdList.map(w => (
            <div key={w.id} onClick={() => setSelected(w)} style={{
              ...cardBase,
              border: `1px solid ${w.status === 'pending' ? `${C.gold}50` : C.b1}`,
              padding: '14px 16px', marginBottom: 10, borderRadius: 16,
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#10B981', letterSpacing: -0.3 }}>
                  {formatGeo(w.amount)} GEO
                </div>
                <div style={{ fontSize: 12, color: C.t3, marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Smartphone size={10} color={C.t3} />
                  <span style={{ fontFamily: 'monospace', color: C.blue }}>{w.phone}</span>
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 3, display: 'flex', gap: 5, alignItems: 'center' }}>
                  <User size={10} color={C.t3} />
                  {w.users?.username ? `@${w.users.username}` : `tg:${w.users?.telegram_id}`}
                  <span>·</span>
                  <Clock size={10} color={C.t3} /> {fmtDate(w.created_at)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <StatusBadge status={w.status} />
                <ChevronRight size={16} color={C.t3} />
              </div>
            </div>
          ))}

          {selected && (
            <WithdrawalSheet
              w={selected}
              geoRate={geoRate}
              onClose={() => setSelected(null)}
              onApprove={approve}
              onReject={reject}
              busy={busy}
            />
          )}
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
              ['Super Admin ID',  String(import.meta.env.VITE_SUPER_ADMIN_TG_ID || '—')],
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

// ─── Tab: Gamification ────────────────────────────────────────────────────────

const TYPE_LABEL = { daily: 'Ежедневные', weekly: 'Еженедельные', onetime: 'Разовые' };
const TYPE_COLOR = { daily: C.blue, weekly: '#10B981', onetime: C.gold };

function InlineEdit({ value, onSave, type = 'text', style = {} }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  if (!editing) return (
    <span
      onClick={() => { setVal(value); setEditing(true); }}
      style={{ cursor: 'pointer', borderBottom: `1px dashed ${C.b2}`, ...style }}
    >
      {value}
    </span>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        type={type}
        style={{ background: C.card, border: `1.5px solid ${SA_COLOR}50`, borderRadius: 6, padding: '3px 7px', color: C.t1, fontSize: 'inherit', width: type === 'number' ? 70 : 160, outline: 'none' }}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(val); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
      />
      <button onClick={() => { onSave(val); setEditing(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10B981', padding: 2 }}><Check size={13} /></button>
      <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 2 }}><X size={13} /></button>
    </span>
  );
}

function GamificationTab() {
  const [section,      setSection]      = useState('tasks');
  const [tasks,        setTasks]        = useState([]);
  const [achs,         setAchs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [busy,         setBusy]         = useState(null);
  const [showAddTask,  setShowAddTask]  = useState(false);
  const [showAddAch,   setShowAddAch]   = useState(false);
  const [newTask,      setNewTask]      = useState({ key: '', type: 'daily', title: '', geo_reward: '', xp_reward: '' });
  const [newAch,       setNewAch]       = useState({ key: '', title: '', description: '', geo_reward: '', xp_reward: '' });
  const [msg,          setMsg]          = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      saFetch('/api/superadmin/tasks'),
      saFetch('/api/superadmin/achievements'),
    ])
      .then(([t, a]) => { setTasks(t.tasks || []); setAchs(a.achievements || []); })
      .catch(e => setMsg(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function patchTask(key, updates) {
    setBusy(key);
    try {
      await saFetch(`/api/superadmin/tasks/${key}`, { method: 'PATCH', body: JSON.stringify(updates) });
      setTasks(prev => prev.map(t => t.key === key ? { ...t, ...updates } : t));
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  async function deleteTask(key) {
    if (!window.confirm(`Удалить задание "${key}"?`)) return;
    setBusy(key);
    try {
      await saFetch(`/api/superadmin/tasks/${key}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.key !== key));
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  async function createTask() {
    if (!newTask.key || !newTask.title) return setMsg('Заполните key и title');
    setBusy('create_task');
    try {
      const d = await saFetch('/api/superadmin/tasks', { method: 'POST', body: JSON.stringify({
        ...newTask, geo_reward: Number(newTask.geo_reward), xp_reward: Number(newTask.xp_reward), requirement: {},
      }) });
      setTasks(prev => [...prev, d.task]);
      setNewTask({ key: '', type: 'daily', title: '', geo_reward: '', xp_reward: '' });
      setShowAddTask(false);
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  async function patchAch(key, updates) {
    setBusy(key);
    try {
      await saFetch(`/api/superadmin/achievements/${key}`, { method: 'PATCH', body: JSON.stringify(updates) });
      setAchs(prev => prev.map(a => a.key === key ? { ...a, ...updates } : a));
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  async function deleteAch(key) {
    if (!window.confirm(`Удалить достижение "${key}"?`)) return;
    setBusy(key);
    try {
      await saFetch(`/api/superadmin/achievements/${key}`, { method: 'DELETE' });
      setAchs(prev => prev.filter(a => a.key !== key));
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  async function createAch() {
    if (!newAch.key || !newAch.title || !newAch.description) return setMsg('Заполните key, title, description');
    setBusy('create_ach');
    try {
      const d = await saFetch('/api/superadmin/achievements', { method: 'POST', body: JSON.stringify({
        ...newAch, geo_reward: Number(newAch.geo_reward), xp_reward: Number(newAch.xp_reward), requirement: {},
      }) });
      setAchs(prev => [...prev, d.achievement]);
      setNewAch({ key: '', title: '', description: '', geo_reward: '', xp_reward: '' });
      setShowAddAch(false);
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  const inStyle = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.b2}`, background: C.card, color: C.t1, fontSize: 13, outline: 'none', marginBottom: 8 };

  const taskGroups = ['daily', 'weekly', 'onetime'];

  return (
    <div>
      {msg && (
        <div style={{ background: `${C.red}10`, border: `1.5px solid ${C.red}30`, borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: C.red }}>
          {msg} <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontWeight: 700, marginLeft: 8 }}>×</button>
        </div>
      )}

      {/* Section switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['tasks', 'Задания', Target], ['achievements', 'Достижения', Trophy]].map(([k, lbl, Icon]) => (
          <button key={k} onClick={() => setSection(k)} style={{
            flex: 1, padding: '10px 4px', borderRadius: 12, fontSize: 13, fontWeight: 700,
            border: `1.5px solid ${section === k ? SA_COLOR : C.b1}`,
            background: section === k ? `${SA_COLOR}18` : 'transparent',
            color: section === k ? SA_COLOR : C.t3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Icon size={14} color={section === k ? SA_COLOR : C.t3} />
            {lbl}
          </button>
        ))}
      </div>

      {loading && [1,2,3].map(i => (
        <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '14px 16px', marginBottom: 8, borderRadius: 14 }}>
          <Skel h={13} w="60%" r={6} /><div style={{ marginTop: 8 }}><Skel h={10} w="40%" r={5} /></div>
        </div>
      ))}

      {/* ── Tasks ── */}
      {!loading && section === 'tasks' && (
        <div>
          {taskGroups.map(type => {
            const items = tasks.filter(t => t.type === type);
            if (!items.length) return null;
            return (
              <div key={type} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[type], textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                  {TYPE_LABEL[type]}
                </div>
                {items.map(t => (
                  <div key={t.key} style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '13px 14px', marginBottom: 8, borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
                          <InlineEdit value={t.title} onSave={v => patchTask(t.key, { title: v })} />
                        </div>
                        <code style={{ fontSize: 11, color: C.t3, background: C.b1, padding: '1px 6px', borderRadius: 5 }}>{t.key}</code>
                      </div>
                      <button
                        onClick={() => deleteTask(t.key)}
                        disabled={busy === t.key}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, opacity: 0.7, padding: '2px 4px', flexShrink: 0 }}
                      >
                        {busy === t.key ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                      <span style={{ color: C.t3 }}>GEO:</span>
                      <span style={{ color: C.gold, fontWeight: 700 }}>
                        <InlineEdit value={t.geo_reward} onSave={v => patchTask(t.key, { geo_reward: Number(v) })} type="number" />
                      </span>
                      <span style={{ color: C.t3, marginLeft: 8 }}>XP:</span>
                      <span style={{ color: '#8B5CF6', fontWeight: 700 }}>
                        <InlineEdit value={t.xp_reward} onSave={v => patchTask(t.key, { xp_reward: Number(v) })} type="number" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Add task */}
          {showAddTask ? (
            <div style={{ ...cardBase, border: `1.5px solid ${SA_COLOR}40`, padding: '16px', borderRadius: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: SA_COLOR, marginBottom: 12 }}>Новое задание</div>
              <input value={newTask.key} onChange={e => setNewTask(p => ({ ...p, key: e.target.value }))} placeholder="key (snake_case)" style={inStyle} />
              <select value={newTask.type} onChange={e => setNewTask(p => ({ ...p, type: e.target.value }))} style={{ ...inStyle, appearance: 'none' }}>
                <option value="daily">Ежедневное</option>
                <option value="weekly">Еженедельное</option>
                <option value="onetime">Разовое</option>
              </select>
              <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Название задания" style={inStyle} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newTask.geo_reward} onChange={e => setNewTask(p => ({ ...p, geo_reward: e.target.value }))} placeholder="GEO" type="number" style={{ ...inStyle, flex: 1 }} />
                <input value={newTask.xp_reward} onChange={e => setNewTask(p => ({ ...p, xp_reward: e.target.value }))} placeholder="XP" type="number" style={{ ...inStyle, flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="ghost" size="sm" onClick={() => setShowAddTask(false)} style={{ flex: 1 }}>Отмена</Btn>
                <Btn variant="purple" size="sm" onClick={createTask} loading={busy === 'create_task'} style={{ flex: 2 }}>Создать</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="ghost" size="sm" onClick={() => setShowAddTask(true)} style={{ width: '100%', marginTop: 4 }}>
              <Plus size={14} /> Добавить задание
            </Btn>
          )}
        </div>
      )}

      {/* ── Achievements ── */}
      {!loading && section === 'achievements' && (
        <div>
          {achs.map(a => (
            <div key={a.key} style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '13px 14px', marginBottom: 8, borderRadius: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 3 }}>
                    <InlineEdit value={a.title} onSave={v => patchAch(a.key, { title: v })} />
                  </div>
                  <div style={{ fontSize: 12, color: C.t3, marginBottom: 4 }}>
                    <InlineEdit value={a.description} onSave={v => patchAch(a.key, { description: v })} />
                  </div>
                  <code style={{ fontSize: 11, color: C.t3, background: C.b1, padding: '1px 6px', borderRadius: 5 }}>{a.key}</code>
                </div>
                <button
                  onClick={() => deleteAch(a.key)}
                  disabled={busy === a.key}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, opacity: 0.7, padding: '2px 4px', flexShrink: 0 }}
                >
                  {busy === a.key ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: C.t3 }}>GEO:</span>
                <span style={{ color: C.gold, fontWeight: 700 }}>
                  <InlineEdit value={a.geo_reward} onSave={v => patchAch(a.key, { geo_reward: Number(v) })} type="number" />
                </span>
                <span style={{ color: C.t3, marginLeft: 8 }}>XP:</span>
                <span style={{ color: '#8B5CF6', fontWeight: 700 }}>
                  <InlineEdit value={a.xp_reward} onSave={v => patchAch(a.key, { xp_reward: Number(v) })} type="number" />
                </span>
              </div>
            </div>
          ))}

          {showAddAch ? (
            <div style={{ ...cardBase, border: `1.5px solid ${SA_COLOR}40`, padding: '16px', borderRadius: 16, marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: SA_COLOR, marginBottom: 12 }}>Новое достижение</div>
              <input value={newAch.key} onChange={e => setNewAch(p => ({ ...p, key: e.target.value }))} placeholder="key (snake_case)" style={inStyle} />
              <input value={newAch.title} onChange={e => setNewAch(p => ({ ...p, title: e.target.value }))} placeholder="Название" style={inStyle} />
              <input value={newAch.description} onChange={e => setNewAch(p => ({ ...p, description: e.target.value }))} placeholder="Описание" style={inStyle} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newAch.geo_reward} onChange={e => setNewAch(p => ({ ...p, geo_reward: e.target.value }))} placeholder="GEO" type="number" style={{ ...inStyle, flex: 1 }} />
                <input value={newAch.xp_reward} onChange={e => setNewAch(p => ({ ...p, xp_reward: e.target.value }))} placeholder="XP" type="number" style={{ ...inStyle, flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="ghost" size="sm" onClick={() => setShowAddAch(false)} style={{ flex: 1 }}>Отмена</Btn>
                <Btn variant="purple" size="sm" onClick={createAch} loading={busy === 'create_ach'} style={{ flex: 2 }}>Создать</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="ghost" size="sm" onClick={() => setShowAddAch(true)} style={{ width: '100%', marginTop: 4 }}>
              <Plus size={14} /> Добавить достижение
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Promo QR Hunt ────────────────────────────────────────────────────────────

const RARITY_CFG = {
  common:    { label: 'Common',    color: '#9CA3AF', bg: 'rgba(156,163,175,0.10)', geo: 5   },
  rare:      { label: 'Rare',      color: '#60A5FA', bg: 'rgba(96,165,250,0.10)',  geo: 10  },
  epic:      { label: 'Epic',      color: '#C084FC', bg: 'rgba(192,132,252,0.10)', geo: 25  },
  legendary: { label: 'Legendary', color: '#FBBF24', bg: 'rgba(251,191,36,0.10)', geo: 100 },
};

function RarityBadge({ rarity }) {
  const r = RARITY_CFG[rarity] || RARITY_CFG.common;
  return <Badge label={r.label} color={r.color} bg={r.bg} />;
}

function PromoStatusBadge({ p }) {
  if (p.isExhausted) return <Badge label="ЗАВЕРШЕНА" color={C.t3} />;
  if (p.isExpired)   return <Badge label="ИСТЕКЛА"   color={C.orange} />;
  if (!p.active)     return <Badge label="ПАУЗА"     color={C.gold} />;
  return <Badge label="АКТИВНА" color="#10B981" />;
}

function PromoCreateSheet({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', description: '', rarity: 'common', reward_amount: '',
    max_claims: '', lat: '', lng: '', radius_m: '200',
    expires_at: '', cooldown_hours: '0', image_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const today = new Date().toISOString().split('T')[0];

  function upd(k, v) { setForm(p => ({ ...p, [k]: v })); }

  const rarityReward = RARITY_CFG[form.rarity]?.geo || 5;
  const rewardVal    = parseInt(form.reward_amount, 10) || rarityReward;

  // Auto-fill reward from rarity
  useEffect(() => { upd('reward_amount', String(RARITY_CFG[form.rarity]?.geo || 5)); }, [form.rarity]);

  async function handleCreate() {
    const missing = [];
    if (!form.title.trim())                          missing.push('название');
    if (!form.max_claims)                            missing.push('макс. клеймов');
    if (!form.lat || isNaN(parseFloat(form.lat)))    missing.push('широта (lat)');
    if (!form.lng || isNaN(parseFloat(form.lng)))    missing.push('долгота (lng)');
    if (missing.length) { setError('Заполните: ' + missing.join(', ')); return; }

    setLoading(true); setError('');
    try {
      const body = {
        title:          form.title.trim(),
        description:    form.description.trim() || null,
        rarity:         form.rarity,
        reward_amount:  parseInt(form.reward_amount, 10),
        max_claims:     parseInt(form.max_claims, 10),
        lat:            parseFloat(form.lat),
        lng:            parseFloat(form.lng),
        radius_m:       parseInt(form.radius_m, 10) || 200,
        expires_at:     form.expires_at ? new Date(form.expires_at + 'T23:59:59').toISOString() : null,
        cooldown_hours: parseInt(form.cooldown_hours, 10) || 0,
        image_url:      form.image_url.trim() || null,
      };
      const d = await saFetch('/api/superadmin/promo-campaigns', { method: 'POST', body: JSON.stringify(body) });
      onCreated(d);
    } catch (e) {
      setError(e.message || 'Ошибка создания');
    } finally { setLoading(false); }
  }

  const canSubmit = !loading;

  const inStyle = {
    width: '100%', boxSizing: 'border-box',
    background: C.card, border: `1.5px solid ${C.b1}`, borderRadius: 12,
    padding: '11px 14px', fontSize: 14, color: C.t1, outline: 'none',
  };
  const labelSt = { fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6, display: 'block' };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 400, animation: 'backdropIn 0.22s ease' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
        background: C.surf, borderRadius: '24px 24px 0 0',
        border: `1px solid ${C.b2}`, borderBottom: 'none',
        maxWidth: 480, margin: '0 auto', maxHeight: '92vh', overflowY: 'auto',
        animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)', padding: '0 0 44px',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 20px' }} />
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4, color: C.t1 }}>Новый Promo QR</div>
          <div style={{ fontSize: 13, color: C.t3, marginBottom: 22 }}>Городская QR-акция от платформы GeoEarn</div>

          {/* Rarity selector */}
          <div style={{ marginBottom: 16 }}>
            <span style={labelSt}>Редкость</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.entries(RARITY_CFG).map(([key, r]) => (
                <button key={key} onClick={() => upd('rarity', key)} style={{
                  flex: 1, padding: '10px 4px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  border: `2px solid ${form.rarity === key ? r.color : C.b1}`,
                  background: form.rarity === key ? r.bg : 'transparent',
                  color: form.rarity === key ? r.color : C.t3, transition: 'all 0.15s',
                }}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div style={{ marginBottom: 12 }}>
            <span style={labelSt}>Название*</span>
            <input value={form.title} onChange={e => upd('title', e.target.value)} placeholder="Например: Летний квест на Бродвей" style={inStyle} />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 12 }}>
            <span style={labelSt}>Описание</span>
            <textarea value={form.description} onChange={e => upd('description', e.target.value)}
              rows={2} placeholder="Краткое описание акции..." style={{ ...inStyle, resize: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Reward + Claims */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={labelSt}>Награда (GEO)*</span>
              <input value={form.reward_amount} onChange={e => upd('reward_amount', e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={inStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelSt}>Макс. клеймов*</span>
              <input value={form.max_claims} onChange={e => upd('max_claims', e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="100" style={inStyle} />
            </div>
          </div>

          {/* Cost preview */}
          {form.reward_amount && form.max_claims && (
            <div style={{
              background: `${SA_COLOR}10`, border: `1px solid ${SA_COLOR}30`,
              borderRadius: 10, padding: '10px 14px', marginBottom: 14,
              fontSize: 13, fontWeight: 700, color: SA_COLOR,
            }}>
              Суммарный выброс: {formatGeo(parseInt(form.reward_amount, 10) * parseInt(form.max_claims, 10))} GEO
            </div>
          )}

          {/* Coordinates */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={labelSt}>Широта (lat)*</span>
              <input value={form.lat} onChange={e => upd('lat', e.target.value)} inputMode="decimal" placeholder="41.2995" style={inStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelSt}>Долгота (lng)*</span>
              <input value={form.lng} onChange={e => upd('lng', e.target.value)} inputMode="decimal" placeholder="69.2401" style={inStyle} />
            </div>
          </div>

          {/* Radius + Cooldown */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={labelSt}>Радиус (м)</span>
              <input value={form.radius_m} onChange={e => upd('radius_m', e.target.value.replace(/\D/g, ''))} inputMode="numeric" style={inStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={labelSt}>Кулдаун (ч)</span>
              <input value={form.cooldown_hours} onChange={e => upd('cooldown_hours', e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="0 = раз навсегда" style={inStyle} />
            </div>
          </div>

          {/* Expires at */}
          <div style={{ marginBottom: 12 }}>
            <span style={labelSt}>Дата окончания</span>
            <input type="date" value={form.expires_at} min={today} onChange={e => upd('expires_at', e.target.value)}
              style={{ ...inStyle, colorScheme: 'dark', cursor: 'pointer' }} />
          </div>

          {/* Image URL */}
          <div style={{ marginBottom: 20 }}>
            <span style={labelSt}>URL баннера/изображения</span>
            <input value={form.image_url} onChange={e => upd('image_url', e.target.value)} placeholder="https://..." style={inStyle} />
          </div>

          {error && (
            <div style={{ background: C.redFt, border: `1px solid rgba(255,59,92,0.2)`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: C.red, fontWeight: 700, marginBottom: 14 }}>
              {error}
            </div>
          )}

          <Btn variant="purple" size="lg" onClick={handleCreate} loading={loading} disabled={!canSubmit}>
            <Plus size={15} /> Создать Promo QR
          </Btn>
        </div>
      </div>
    </>
  );
}

function PromoResultSheet({ result, onClose }) {
  const [copied,    setCopied]    = useState(false);
  const [dlLoading, setDlLoading] = useState(false);
  const [dlSent,    setDlSent]    = useState(false);

  function copy() {
    navigator.clipboard?.writeText(result.qrUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendQR() {
    setDlLoading(true);
    try {
      const r = await apiFetch('/api/send-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: result.qrUrl,
          caption: `🎯 *${result.campaign.title}*\nPromo QR-код`,
        }),
      });
      if (r.ok) { setDlSent(true); setTimeout(() => setDlSent(false), 3000); }
    } catch { /* silent */ } finally {
      setDlLoading(false);
    }
  }

  const r = RARITY_CFG[result.campaign.rarity] || RARITY_CFG.common;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 400, animation: 'backdropIn 0.22s ease' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
        background: C.surf, borderRadius: '24px 24px 0 0',
        border: `1px solid ${C.b2}`, borderBottom: 'none',
        maxWidth: 480, margin: '0 auto', maxHeight: '90vh', overflowY: 'auto',
        animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)', padding: '0 0 44px',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 20px' }} />
        <div style={{ padding: '0 20px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20,
            background: r.bg, border: `1px solid ${r.color}40`, marginBottom: 12,
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: r.color, textTransform: 'uppercase', letterSpacing: 0.8 }}>{r.label}</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 20, color: C.t1, marginBottom: 4 }}>Promo QR создан!</div>
          <div style={{ fontSize: 14, color: C.t3, marginBottom: 20 }}>{result.campaign.title}</div>

          {/* QR code image */}
          <div style={{ display: 'inline-block', padding: 12, borderRadius: 16, background: '#fff', marginBottom: 16 }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=1&bgcolor=FFFFFF&color=000000&data=${encodeURIComponent(result.qrUrl)}`}
              alt="QR" style={{ width: 180, height: 180, display: 'block', borderRadius: 6 }}
            />
          </div>

          {/* QR URL */}
          <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '10px 14px', marginBottom: 14, textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 4 }}>QR URL</div>
            <div style={{ fontSize: 11, color: r.color, wordBreak: 'break-all', fontFamily: 'monospace' }}>{result.qrUrl}</div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" size="md" onClick={copy} style={{ flex: 1 }}>
              {copied ? <CheckCircle size={14} /> : <Plus size={14} />}
              {copied ? 'Скопировано' : 'Копировать URL'}
            </Btn>
            <Btn variant={dlSent ? 'success' : 'purple'} size="md" onClick={sendQR} loading={dlLoading} style={{ flex: 1 }}>
              {dlSent ? <CheckCircle size={14} /> : <Send size={14} />}
              {dlSent ? 'Отправлено' : 'В Telegram'}
            </Btn>
          </div>
          <div style={{ marginTop: 12 }}>
            <Btn variant="ghost" size="lg" onClick={onClose}>Закрыть</Btn>
          </div>
        </div>
      </div>
    </>
  );
}

function PromoAnalyticsSheet({ campaign, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const [dlLoad,  setDlLoad]  = useState(false);
  const [dlSent,  setDlSent]  = useState(false);
  const r = RARITY_CFG[campaign.rarity] || RARITY_CFG.common;

  useEffect(() => {
    saFetch(`/api/superadmin/promo-campaigns/${campaign.id}/analytics`)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaign.id]);

  async function toggleActive() {
    setBusy(true);
    try {
      await saFetch(`/api/superadmin/promo-campaigns/${campaign.id}`, { method: 'PATCH', body: JSON.stringify({ active: !campaign.active }) });
      onClose('reload');
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  async function sendQR() {
    setDlLoad(true);
    try {
      const r = await apiFetch('/api/send-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: campaign.qrUrl,
          caption: `🎯 *${campaign.title}*\nPromo QR-код`,
        }),
      });
      if (r.ok) { setDlSent(true); setTimeout(() => setDlSent(false), 3000); }
    } catch { /* silent */ } finally {
      setDlLoad(false);
    }
  }

  return (
    <>
      <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 400, animation: 'backdropIn 0.22s ease' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
        background: C.surf, borderRadius: '24px 24px 0 0',
        border: `1px solid ${C.b2}`, borderBottom: 'none',
        maxWidth: 480, margin: '0 auto', maxHeight: '90vh', overflowY: 'auto',
        animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)', padding: '0 0 44px',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 20px' }} />
        <div style={{ padding: '0 20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <RarityBadge rarity={campaign.rarity} />
                <PromoStatusBadge p={campaign} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.t1 }}>{campaign.title}</div>
              {campaign.description && <div style={{ fontSize: 13, color: C.t3, marginTop: 3 }}>{campaign.description}</div>}
            </div>
          </div>

          {/* QR mini */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ padding: 8, borderRadius: 10, background: '#fff', flexShrink: 0 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&margin=0&bgcolor=FFFFFF&color=000000&data=${encodeURIComponent(campaign.qrUrl)}`}
                alt="QR" style={{ width: 64, height: 64, display: 'block' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: C.t3, marginBottom: 3 }}>QR URL</div>
              <div style={{ fontSize: 10, color: r.color, wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.4 }}>{campaign.qrUrl}</div>
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Клеймов',   value: campaign.claims_count,  color: '#10B981' },
              { label: 'Осталось',  value: campaign.remaining,      color: r.color   },
              { label: 'GEO выдано',value: formatGeo(campaign.totalGeo), color: C.gold },
            ].map(s => (
              <div key={s.label} style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '12px 10px', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontWeight: 900, fontSize: 20, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: C.t3, marginTop: 3, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Fill bar */}
          <div style={{ background: C.b0, borderRadius: 4, height: 6, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${Math.min(100, Math.round(campaign.claims_count / campaign.max_claims * 100))}%`,
              background: r.color, transition: 'width 0.5s',
              boxShadow: `0 0 8px ${r.color}60`,
            }} />
          </div>

          {/* Details */}
          <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px', marginBottom: 14, borderRadius: 14 }}>
            {[
              { label: 'Награда',      value: `+${formatGeo(campaign.reward_amount)} GEO` },
              { label: 'Радиус',       value: `${campaign.radius_m} м` },
              { label: 'Кулдаун',      value: campaign.cooldown_hours > 0 ? `${campaign.cooldown_hours} ч` : 'Одноразово' },
              { label: 'Истекает',     value: campaign.expires_at ? fmtDay(campaign.expires_at) : 'Без ограничения' },
              { label: 'Координаты',   value: `${campaign.lat?.toFixed(4)}, ${campaign.lng?.toFixed(4)}` },
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between', paddingBottom: 8, marginBottom: 8,
                borderBottom: i < arr.length - 1 ? `1px solid ${C.b0}` : 'none',
              }}>
                <span style={{ fontSize: 12, color: C.t3 }}>{row.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Recent claims */}
          {loading && <div style={{ marginBottom: 14 }}><Skel h={40} r={10} /></div>}
          {!loading && data && data.claims.length > 0 && (
            <>
              <SectionTitle icon={Users} color={C.t3}>Последние клеймы ({data.uniqueUsers} уникальных)</SectionTitle>
              <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 14 }}>
                {data.claims.slice(0, 20).map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: `1px solid ${C.b0}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
                        {c.username ? `@${c.username}` : `ID ${c.telegram_id}`}
                      </div>
                      <div style={{ fontSize: 11, color: C.t3 }}>{fmtDate(c.claimed_at)}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: r.color }}>+{c.geo_awarded}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant={campaign.active ? 'gold' : 'success'} size="md" onClick={toggleActive} loading={busy} style={{ flex: 1 }}>
              {campaign.active ? <><PauseCircle size={13} /> Пауза</> : <><PlayCircle size={13} /> Запустить</>}
            </Btn>
            <Btn variant={dlSent ? 'success' : 'ghost'} size="md" onClick={sendQR} loading={dlLoad} style={{ flex: 1 }}>
              {dlSent ? <CheckCircle size={13} /> : <Send size={13} />}
              {dlSent ? 'Отправлено' : 'QR в Telegram'}
            </Btn>
          </div>
        </div>
      </div>
    </>
  );
}

function PromoQRTab() {
  const [campaigns,   setCampaigns]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [createResult, setCreateResult] = useState(null);
  const [detail,      setDetail]      = useState(null);
  const [filter,      setFilter]      = useState('all');

  function load() {
    setLoading(true);
    saFetch('/api/superadmin/promo-campaigns')
      .then(d => setCampaigns(d.campaigns || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleDelete(id, title) {
    if (!confirm(`Удалить "${title}"? Это действие необратимо.`)) return;
    try {
      await saFetch(`/api/superadmin/promo-campaigns/${id}`, { method: 'DELETE' });
      setCampaigns(prev => prev.filter(c => c.id !== id));
    } catch (e) { alert(e.message); }
  }

  const filtered = campaigns.filter(c => {
    if (filter === 'active')  return c.active && !c.isExpired && !c.isExhausted;
    if (filter === 'paused')  return !c.active && !c.isExpired && !c.isExhausted;
    if (filter === 'done')    return c.isExpired || c.isExhausted;
    return true;
  });

  const totalGeo   = campaigns.reduce((s, c) => s + c.totalGeo, 0);
  const totalClaims = campaigns.reduce((s, c) => s + c.claims_count, 0);
  const activeCount = campaigns.filter(c => c.active && !c.isExpired && !c.isExhausted).length;

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px 10px', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: '#10B981' }}>{activeCount}</div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Активных</div>
        </div>
        <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px 10px', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: C.gold }}>{totalClaims}</div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Клеймов</div>
        </div>
        <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px 10px', borderRadius: 14, textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 22, color: SA_COLOR }}>{formatGeo(totalGeo)}</div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>GEO выдано</div>
        </div>
      </div>

      <Btn variant="purple" size="md" onClick={() => setShowCreate(true)} style={{ width: '100%', marginBottom: 14 }}>
        <Plus size={15} /> Создать Promo QR
      </Btn>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['all','Все'],['active','Активные'],['paused','На паузе'],['done','Завершённые']].map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            flexShrink: 0, padding: '7px 11px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: `1.5px solid ${filter === k ? SA_COLOR : C.b1}`,
            background: filter === k ? `${SA_COLOR}18` : 'transparent',
            color: filter === k ? SA_COLOR : C.t3,
          }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading && [1,2,3].map(i => (
        <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '16px', marginBottom: 10, borderRadius: 16 }}>
          <Skel h={14} w="55%" r={6} /><div style={{ marginTop: 8 }}><Skel h={10} w="35%" r={5} /></div>
        </div>
      ))}

      {!loading && filtered.length === 0 && (
        <Empty icon={Megaphone} text="Нет промо-кампаний" />
      )}

      {!loading && filtered.map((c, i) => {
        const r = RARITY_CFG[c.rarity] || RARITY_CFG.common;
        const fillPct = c.max_claims > 0 ? Math.round(c.claims_count / c.max_claims * 100) : 0;
        return (
          <div key={c.id} style={{
            ...cardBase,
            border: `1px solid ${c.active && !c.isExpired && !c.isExhausted ? `${r.color}40` : C.b1}`,
            padding: '14px 16px', marginBottom: 10, borderRadius: 16,
            animation: `fadeUp 0.3s ${i * 0.04}s ease both`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                  <RarityBadge rarity={c.rarity} />
                  <PromoStatusBadge p={c} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.t1, marginBottom: 2 }}>{c.title}</div>
                <div style={{ fontSize: 11, color: C.t3 }}>
                  {c.claims_count}/{c.max_claims} · {c.remaining} осталось · {c.radius_m}м
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: r.color }}>+{formatGeo(c.reward_amount)}</div>
                <div style={{ fontSize: 10, color: C.t3 }}>GEO</div>
              </div>
            </div>

            {/* Fill bar */}
            <div style={{ background: C.b0, borderRadius: 3, height: 4, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${fillPct}%`, background: r.color, transition: 'width 0.5s' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" size="sm" onClick={() => setDetail(c)} style={{ flex: 2 }}>
                <BarChart3 size={12} /> Аналитика
              </Btn>
              <Btn variant="danger" size="sm" onClick={() => handleDelete(c.id, c.title)} style={{ flex: 1 }}>
                <Trash2 size={12} />
              </Btn>
            </div>
          </div>
        );
      })}

      {showCreate && (
        <PromoCreateSheet
          onClose={() => setShowCreate(false)}
          onCreated={result => { setShowCreate(false); setCreateResult(result); load(); }}
        />
      )}
      {createResult && (
        <PromoResultSheet result={createResult} onClose={() => setCreateResult(null)} />
      )}
      {detail && (
        <PromoAnalyticsSheet
          campaign={detail}
          onClose={action => { setDetail(null); if (action === 'reload') load(); }}
        />
      )}
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

// ─── Tab: GeoHunt ────────────────────────────────────────────────────────────

const GH_GOLD  = C.gold;
const GH_BG    = C.goldFt;
const GH_BORDER = C.goldGl;

function GeoHuntCodesSheet({ hunt, onClose }) {
  const [codes,    setCodes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [sendMsg,  setSendMsg]  = useState('');

  useEffect(() => {
    saFetch(`/api/sa/geohunts/${hunt.id}/codes`)
      .then(d => setCodes(d.codes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hunt.id]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function copyAll() {
    const lines = codes.map(c =>
      `${c.point_label || `Код ${c.id.slice(0, 6)}`}: ${baseUrl}/checkin?token=${c.token}&geohunt=1`
    ).join('\n');
    navigator.clipboard?.writeText(lines).catch(() => {});
  }

  async function sendQr() {
    setSending(true);
    setSendMsg('');
    try {
      const d = await saFetch(`/api/sa/geohunts/${hunt.id}/send-qr`, { method: 'POST' });
      setSendMsg(`Отправлено ${d.total} QR в Telegram`);
    } catch {
      setSendMsg('Ошибка отправки');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.surf, borderRadius: '24px 24px 0 0',
        border: `1px solid ${C.b2}`, borderBottom: 'none',
        padding: '0 0 40px', zIndex: 301,
        maxWidth: 480, margin: '0 auto',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 10px', flexShrink: 0 }} />
        <div style={{ padding: '0 20px 10px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: GH_GOLD }}>{hunt.title}</div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>
              {hunt.claimed_codes}/{hunt.total_codes} кодов использовано · {hunt.reward_per_code} GEO/код
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Btn variant="ghost" size="sm" onClick={copyAll}><Send size={12} /> Скопировать все</Btn>
            <Btn variant="ghost" size="sm" onClick={sendQr} disabled={sending}>
              <Send size={12} /> {sending ? 'Отправка…' : 'В Telegram'}
            </Btn>
          </div>
        </div>
        {sendMsg && (
          <div style={{ margin: '0 20px 8px', fontSize: 12, color: GH_GOLD, textAlign: 'right' }}>{sendMsg}</div>
        )}
        <div style={{ overflowY: 'auto', padding: '0 20px', flex: 1 }}>
          {loading && [1,2,3].map(i => (
            <div key={i} style={{ ...cardBase, padding: '10px 14px', marginBottom: 8, borderRadius: 12 }}>
              <Skel h={12} w="70%" r={5} />
            </div>
          ))}
          {!loading && codes.length === 0 && <Empty icon={QrCode} text="Нет кодов" />}
          {!loading && codes.map((c, i) => (
            <div key={c.id} style={{
              ...cardBase,
              border: `1px solid ${c.used_by ? `${C.red}30` : GH_BORDER}`,
              padding: '10px 14px', marginBottom: 6, borderRadius: 12,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              animation: `fadeUp 0.25s ${i * 0.02}s ease both`,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 2 }}>
                  {c.point_label || `Код ${i + 1}`}
                </div>
                <div style={{ fontSize: 10, color: C.t3, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {c.token}
                </div>
              </div>
              <div style={{ flexShrink: 0, marginLeft: 10 }}>
                {c.used_by
                  ? <Badge label="ИСПОЛЬЗОВАН" color={C.red} />
                  : <Badge label="СВОБОДЕН" color={GH_GOLD} />
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function GeoHuntTab() {
  const [hunts,      setHunts]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewCodes,  setViewCodes]  = useState(null);
  const [busy,       setBusy]       = useState({});
  const [msg,        setMsg]        = useState('');

  const [form, setForm] = useState({
    title: '', description: '', reward_per_code: '200',
    code_count: '50', starts_at: '', ends_at: '',
  });
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    saFetch('/api/sa/geohunts')
      .then(d => setHunts(d.hunts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggle(hunt) {
    setBusy(b => ({ ...b, [hunt.id]: true }));
    try {
      const updated = await saFetch(`/api/sa/geohunts/${hunt.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !hunt.active }),
      });
      setHunts(hs => hs.map(h => h.id === hunt.id ? { ...h, active: updated.active } : h));
    } catch (e) { setMsg(e.message); }
    setBusy(b => ({ ...b, [hunt.id]: false }));
  }

  async function createHunt() {
    if (!form.title || !form.reward_per_code || !form.code_count) {
      setMsg('Заполните обязательные поля');
      return;
    }
    setCreating(true);
    try {
      const res = await saFetch('/api/sa/geohunts', {
        method: 'POST',
        body: JSON.stringify({
          title:          form.title,
          description:    form.description || null,
          reward_per_code: parseInt(form.reward_per_code, 10),
          code_count:     parseInt(form.code_count, 10),
          starts_at:      form.starts_at || null,
          ends_at:        form.ends_at   || null,
        }),
      });
      setHunts(hs => [res.hunt, ...hs]);
      setShowCreate(false);
      setForm({ title: '', description: '', reward_per_code: '200', code_count: '50', starts_at: '', ends_at: '' });
      setMsg(`✓ Охота создана: ${res.codes?.length} кодов`);
    } catch (e) { setMsg(e.message); }
    setCreating(false);
  }

  const inSt = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', borderRadius: 10,
    border: `1.5px solid ${C.b2}`, background: C.card,
    color: C.t1, fontSize: 14, outline: 'none',
    WebkitAppearance: 'none', marginTop: 4,
  };
  const lbSt = { fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.6 };

  return (
    <div>
      {msg && (
        <div style={{
          background: msg.startsWith('✓') ? '#10B98118' : C.redFt,
          border: `1px solid ${msg.startsWith('✓') ? '#10B98140' : `${C.red}40`}`,
          color: msg.startsWith('✓') ? '#10B981' : C.red,
          borderRadius: 12, padding: '10px 14px', marginBottom: 14,
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {msg}
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1 }}><X size={14} /></button>
        </div>
      )}

      {/* Info banner */}
      <div style={{
        background: GH_BG, border: `1.5px solid ${GH_BORDER}`,
        borderRadius: 14, padding: '12px 14px', marginBottom: 16,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <Target size={18} color={GH_GOLD} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: GH_GOLD, marginBottom: 2 }}>GeoHunt — одноразовые QR-коды</div>
          <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.5 }}>
            Создайте охоту — платформа сгенерирует уникальные QR-коды. Разместите их по городу. Первый нашедший получает награду.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <SectionTitle icon={Target} color={GH_GOLD}>GeoHunt охоты ({hunts.length})</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={load} loading={loading}><RefreshCw size={13} /></Btn>
          <Btn variant="gold" size="sm" onClick={() => setShowCreate(s => !s)}>
            <Plus size={13} /> Создать
          </Btn>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{
          ...cardBase, border: `1.5px solid ${GH_BORDER}`,
          padding: '18px 16px', marginBottom: 16, borderRadius: 16,
          background: `linear-gradient(160deg, ${GH_BG} 0%, ${C.card} 60%)`,
          animation: 'fadeUp 0.25s ease both',
        }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: GH_GOLD, marginBottom: 16 }}>Новая GeoHunt охота</div>

          <div style={{ marginBottom: 12 }}>
            <span style={lbSt}>Название*</span>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Весенняя охота в Ташкенте" style={inSt} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={lbSt}>Описание</span>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Найди QR-коды по всему городу и получи GEO!"
              style={{ ...inSt, resize: 'none', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <span style={lbSt}>GEO за код*</span>
              <input value={form.reward_per_code} onChange={e => setForm(f => ({ ...f, reward_per_code: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" style={inSt} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={lbSt}>Кол-во кодов*</span>
              <input value={form.code_count} onChange={e => setForm(f => ({ ...f, code_count: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" placeholder="макс. 500" style={inSt} />
            </div>
          </div>

          {form.reward_per_code && form.code_count && (
            <div style={{
              background: GH_BG, border: `1px solid ${GH_BORDER}`,
              borderRadius: 10, padding: '9px 12px', marginBottom: 12,
              fontSize: 13, fontWeight: 700, color: GH_GOLD,
            }}>
              Суммарный выброс: {formatGeo(parseInt(form.reward_per_code || 0, 10) * parseInt(form.code_count || 0, 10))} GEO
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <span style={lbSt}>Старт</span>
              <input value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} type="datetime-local" style={inSt} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={lbSt}>Конец</span>
              <input value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} type="datetime-local" style={inSt} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="gold" size="md" onClick={createHunt} loading={creating} style={{ flex: 1 }}>
              <Target size={14} /> Создать охоту
            </Btn>
            <Btn variant="ghost" size="md" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>
              Отмена
            </Btn>
          </div>
        </div>
      )}

      {loading && [1,2].map(i => (
        <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: 16, marginBottom: 10, borderRadius: 16 }}>
          <Skel h={16} w="50%" r={6} /><div style={{ marginTop: 8 }}><Skel h={10} w="30%" r={5} /></div>
        </div>
      ))}

      {!loading && hunts.length === 0 && !showCreate && <Empty icon={Target} text="Охот нет — создайте первую!" />}

      {!loading && hunts.map((h, i) => (
        <div key={h.id} style={{
          ...cardBase,
          border: `1px solid ${h.active ? GH_BORDER : C.b1}`,
          padding: '14px 16px', marginBottom: 10, borderRadius: 16,
          background: h.active ? `linear-gradient(135deg, ${GH_BG} 0%, ${C.card} 60%)` : C.card,
          animation: `fadeUp 0.3s ${i * 0.04}s ease both`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.title}
                </span>
                {h.active
                  ? <Badge label="АКТИВНА" color={GH_GOLD} />
                  : <Badge label="СТОП"    color={C.t3}    />
                }
              </div>
              <div style={{ fontSize: 12, color: C.t3 }}>
                {h.reward_per_code} GEO/код ·{' '}
                <span style={{ color: h.claimed_codes > 0 ? GH_GOLD : C.t3, fontWeight: 700 }}>
                  {h.claimed_codes}/{h.total_codes}
                </span>{' '}
                найдено
                {h.ends_at && ` · до ${fmtDay(h.ends_at)}`}
              </div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 20, color: GH_GOLD, flexShrink: 0 }}>
              {Math.round((h.claimed_codes / Math.max(h.total_codes, 1)) * 100)}%
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ background: C.b0, borderRadius: 4, height: 4, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{
              height: 4, borderRadius: 4,
              width: `${Math.round((h.claimed_codes / Math.max(h.total_codes, 1)) * 100)}%`,
              background: h.active ? GH_GOLD : C.t3,
              transition: 'width 0.5s',
            }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="ghost" size="sm" onClick={() => setViewCodes(h)} style={{ flex: 1 }}>
              <QrCode size={12} /> Коды ({h.total_codes})
            </Btn>
            {h.active
              ? <Btn variant="danger" size="sm" onClick={() => toggle(h)} loading={busy[h.id]} style={{ flex: 1 }}>
                  <PauseCircle size={13} /> Стоп
                </Btn>
              : <Btn variant="gold" size="sm" onClick={() => toggle(h)} loading={busy[h.id]} style={{ flex: 1 }}>
                  <PlayCircle size={13} /> Запустить
                </Btn>
            }
          </div>
        </div>
      ))}

      {viewCodes && <GeoHuntCodesSheet hunt={viewCodes} onClose={() => setViewCodes(null)} />}
    </div>
  );
}

// ─── Tab: Support ────────────────────────────────────────────────────────────

const SUPPORT_STATUS = {
  open:    { label: 'Открытое',  color: C.gold  },
  replied: { label: 'Отвечено',  color: '#10B981' },
  closed:  { label: 'Закрыто',  color: C.t3    },
};

function SupportMsgSheet({ msg, onClose, onUpdated }) {
  const [reply,     setReply]     = useState('');
  const [sending,   setSending]   = useState(false);
  const [closing,   setClosing]   = useState(false);
  const [err,       setErr]       = useState('');

  const userName = msg.users?.username ? `@${msg.users.username}` : `ID ${msg.users?.telegram_id}`;

  async function sendReply() {
    if (!reply.trim()) { setErr('Введите ответ'); return; }
    setSending(true); setErr('');
    try {
      await saFetch(`/api/superadmin/support/${msg.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ reply: reply.trim() }),
      });
      onUpdated();
      onClose();
    } catch (e) { setErr(e.message || 'Ошибка'); }
    setSending(false);
  }

  async function closeMsg() {
    setClosing(true);
    try {
      await saFetch(`/api/superadmin/support/${msg.id}/close`, { method: 'POST' });
      onUpdated();
      onClose();
    } catch (e) { setErr(e.message || 'Ошибка'); }
    setClosing(false);
  }

  const typeColor = msg.type === 'report' ? C.red : C.geo;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        zIndex: 300, animation: 'backdropIn 0.22s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.surf, borderRadius: '24px 24px 0 0',
        border: `1px solid ${C.b2}`, borderBottom: 'none',
        padding: '0 0 40px', zIndex: 301,
        maxWidth: 480, margin: '0 auto',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 16px', flexShrink: 0 }} />
        <div style={{ padding: '0 20px', overflowY: 'auto', flex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {msg.type === 'report'
              ? <AlertCircle size={16} color={C.red} strokeWidth={2} />
              : <MessageCircle size={16} color={C.geo} strokeWidth={2} />
            }
            <span style={{ fontSize: 15, fontWeight: 800, color: typeColor }}>
              {msg.type === 'report' ? 'Жалоба' : 'Обращение'} #{msg.id}
            </span>
            <span style={{ marginLeft: 'auto' }}>
              <Badge
                label={SUPPORT_STATUS[msg.status]?.label || msg.status}
                color={SUPPORT_STATUS[msg.status]?.color || C.t3}
              />
            </span>
          </div>

          {/* Meta */}
          <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '12px 14px', marginBottom: 14, borderRadius: 14 }}>
            {[
              [User,  'Пользователь', userName,           C.t2 ],
              [Clock, 'Дата',         fmtDate(msg.created_at), C.t3],
            ].map(([Icon, label, val, color], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: i === 0 ? 8 : 0, marginBottom: i === 0 ? 8 : 0, borderBottom: i === 0 ? `1px solid ${C.b0}` : 'none' }}>
                <Icon size={13} color={C.t3} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: C.t3, flexShrink: 0, minWidth: 80 }}>{label}</span>
                <span style={{ fontSize: 13, color, fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Message */}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Сообщение</div>
          <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px', borderRadius: 14, marginBottom: 14 }}>
            <p style={{ fontSize: 14, color: C.t1, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {msg.message}
            </p>
          </div>

          {/* Existing reply */}
          {msg.admin_reply && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageCircleReply size={11} /> Ответ администратора
              </div>
              <div style={{ ...cardBase, border: `1px solid #10B98130`, padding: '14px', borderRadius: 14, marginBottom: 14, background: '#10B98108' }}>
                <p style={{ fontSize: 14, color: C.t1, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.admin_reply}
                </p>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 6 }}>{fmtDate(msg.replied_at)}</div>
              </div>
            </>
          )}

          {/* Reply form (always shown) */}
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
            {msg.admin_reply ? 'Новый ответ' : 'Ответить'}
          </div>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Введите ответ пользователю..."
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 14px', borderRadius: 12,
              border: `1.5px solid ${err ? C.red : C.b2}`,
              background: C.card, color: C.t1,
              fontSize: 14, outline: 'none', resize: 'none',
              lineHeight: 1.5, fontFamily: 'inherit',
              marginBottom: 10,
            }}
          />

          {err && (
            <div style={{ fontSize: 13, color: C.red, fontWeight: 600, marginBottom: 10 }}>{err}</div>
          )}

          <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
            {msg.status !== 'closed' && (
              <Btn variant="ghost" size="md" onClick={closeMsg} loading={closing} style={{ flex: 1 }}>
                Закрыть тикет
              </Btn>
            )}
            <Btn variant="success" size="md" onClick={sendReply} loading={sending} style={{ flex: 2 }}>
              <Send size={14} /> Отправить ответ
            </Btn>
          </div>
        </div>
      </div>
    </>
  );
}

function SupportTab() {
  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('open');
  const [selected,  setSelected]  = useState(null);

  function load(status = filter) {
    setLoading(true);
    saFetch(`/api/superadmin/support?status=${status}`)
      .then(d => setMessages(d.messages || []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(filter); }, [filter]);

  const openCount = messages.filter(m => m.status === 'open').length;

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {[
          { key: 'open',    label: 'Открытые'  },
          { key: 'replied', label: 'Отвечено'  },
          { key: 'closed',  label: 'Закрытые'  },
          { key: 'all',     label: 'Все'        },
        ].map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                flex: '0 0 auto', padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                border: `1px solid ${active ? SA_COLOR : C.b2}`,
                background: active ? `${SA_COLOR}18` : 'transparent',
                color: active ? SA_COLOR : C.t3,
                cursor: 'pointer', transition: 'all 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {label}
              {key === 'open' && openCount > 0 && (
                <span style={{ marginLeft: 6, background: C.red, color: '#fff', borderRadius: 6, padding: '1px 6px', fontSize: 10 }}>
                  {openCount}
                </span>
              )}
            </button>
          );
        })}
        <Btn variant="ghost" size="sm" onClick={() => load(filter)} loading={loading} style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <RefreshCw size={12} />
        </Btn>
      </div>

      {/* Loading skeletons */}
      {loading && [1,2,3].map(i => (
        <div key={i} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '14px 16px', marginBottom: 8, borderRadius: 14 }}>
          <Skel h={13} w="50%" r={6} /><div style={{ marginTop: 8 }}><Skel h={10} w="80%" r={5} /></div>
        </div>
      ))}

      {/* Empty state */}
      {!loading && messages.length === 0 && (
        <Empty icon={MessageCircle} text={filter === 'open' ? 'Нет открытых обращений' : 'Нет сообщений'} />
      )}

      {/* Message list */}
      {!loading && messages.map((msg, i) => {
        const s = SUPPORT_STATUS[msg.status] || { label: msg.status, color: C.t3 };
        const userName = msg.users?.username ? `@${msg.users.username}` : `ID ${msg.users?.telegram_id}`;
        const TypeIcon = msg.type === 'report' ? AlertCircle : MessageCircle;
        const typeColor = msg.type === 'report' ? C.red : C.geo;

        return (
          <div
            key={msg.id}
            onClick={() => setSelected(msg)}
            style={{
              ...cardBase,
              border: `1px solid ${msg.status === 'open' ? `${typeColor}40` : C.b1}`,
              padding: '13px 14px', marginBottom: 8, borderRadius: 14,
              cursor: 'pointer', transition: 'all 0.15s',
              background: msg.status === 'open' ? `${typeColor}06` : C.card,
              animation: `fadeUp 0.25s ${i * 0.03}s ease both`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${typeColor}14`,
                border: `1px solid ${typeColor}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <TypeIcon size={14} color={typeColor} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{userName}</span>
                  <Badge label={s.label} color={s.color} />
                  {msg.type === 'report' && <Badge label="Жалоба" color={C.red} />}
                </div>
                <p style={{ fontSize: 13, color: C.t2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                  {msg.message}
                </p>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 5 }}>#{msg.id} · {fmtDate(msg.created_at)}</div>
              </div>
              <ChevronRight size={14} color={C.t3} style={{ flexShrink: 0, marginTop: 2 }} />
            </div>
          </div>
        );
      })}

      {selected && (
        <SupportMsgSheet
          msg={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => load(filter)}
        />
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'overview',      label: 'Обзор',      Icon: LayoutDashboard },
  { key: 'fraud',         label: 'Фрод',       Icon: ShieldAlert     },
  { key: 'businesses',    label: 'Бизнесы',    Icon: Store           },
  { key: 'campaigns',     label: 'Кампании',   Icon: Megaphone       },
  { key: 'finance',       label: 'Финансы',    Icon: Wallet          },
  { key: 'users',         label: 'Юзеры',      Icon: Users           },
  { key: 'gamification',  label: 'Геймиф.',    Icon: Trophy          },
  { key: 'promo',         label: 'Promo QR',   Icon: QrCode          },
  { key: 'geohunt',       label: 'GeoHunt',    Icon: Target          },
  { key: 'support',       label: 'Поддержка',  Icon: MessageCircle   },
  { key: 'system',        label: 'Система',    Icon: Settings        },
];

export default function SuperAdmin() {
  const [tab, setTab] = useState('overview');
  const geoRate = useGeoRate();
  const [isSA, setIsSA] = useState(null); // null = loading, true/false = resolved

  useEffect(() => {
    apiFetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => setIsSA(d?.is_super_admin === true))
      .catch(() => setIsSA(false));
  }, []);

  if (isSA === null) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} color={SA_COLOR} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

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
        <div style={{ fontSize: 13, color: C.t3 }}>Полный доступ</div>
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
        {tab === 'overview'     && <OverviewTab />}
        {tab === 'fraud'        && <FraudTab />}
        {tab === 'businesses'   && <BusinessesTab />}
        {tab === 'campaigns'    && <CampaignsTab />}
        {tab === 'finance'      && <FinanceTab geoRate={geoRate} />}
        {tab === 'users'        && <UsersTab />}
        {tab === 'gamification' && <GamificationTab />}
        {tab === 'promo'        && <PromoQRTab />}
        {tab === 'geohunt'      && <GeoHuntTab />}
        {tab === 'support'      && <SupportTab />}
        {tab === 'system'       && <SystemTab />}
      </div>
    </div>
  );
}
