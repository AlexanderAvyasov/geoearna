import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, MapPin, Calendar, CreditCard, AlertCircle, Clock, CheckCircle, XCircle, ArrowDownCircle, Loader2, QrCode, Target } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { geoToUzs, formatGeo, formatUzs } from '../lib/geo';
import { C, E, cardBase } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';

const BC = {};

const RARITY_STYLE = {
  common:    { color: '#10B981', bg: '#10B98114', border: '#10B98130' },
  rare:      { color: '#3B82F6', bg: '#3B82F614', border: '#3B82F630' },
  epic:      { color: '#A050FF', bg: '#A050FF14', border: '#A050FF30' },
  legendary: { color: '#F59E0B', bg: '#F59E0B14', border: '#F59E0B30' },
};

function activityMeta(item) {
  if (item.type === 'promo') {
    const r = RARITY_STYLE[item.rarity] || RARITY_STYLE.common;
    return { Icon: QrCode, color: r.color, bg: r.bg, border: r.border, tag: `Promo · ${item.rarity || 'common'}` };
  }
  if (item.type === 'geohunt') {
    return { Icon: Target, color: '#FF8C00', bg: '#FF8C0014', border: '#FF8C0030', tag: 'GeoHunt' };
  }
  return { Icon: MapPin, color: C.geo, bg: C.geoDim, border: C.geoGl, tag: 'Визит' };
}

function formatDate(str) {
  return new Date(str).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Slot machine counter ──────────────────────────────────────────────────────

function SlotDigit({ char, delay }) {
  if (!/\d/.test(char)) {
    return (
      <span style={{ display: 'inline-block', width: char === ' ' ? '0.28em' : undefined }}>
        {char === ' ' ? ' ' : char}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom' }}>
      <span style={{
        display: 'block',
        animation: `slotDrop 0.46s cubic-bezier(0.22,1,0.36,1) ${delay}ms both`,
      }}>
        {char}
      </span>
    </span>
  );
}

function SlotCounter({ value, style, loading }) {
  const [animKey, setAnimKey] = useState(0);
  const prevValue = useRef(null);

  useEffect(() => {
    if (!loading && value > 0 && value !== prevValue.current) {
      prevValue.current = value;
      setAnimKey(k => k + 1);
    }
  }, [value, loading]);

  const formatted = formatGeo(value || 0);

  return (
    <div style={{ ...style, display: 'inline-flex', flexWrap: 'nowrap' }}>
      {formatted.split('').map((ch, i) => (
        <SlotDigit key={`${animKey}-${i}`} char={ch} delay={i * 38} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const WD_STATUS_ICONS = {
  pending:  { Icon: Clock,       color: C.gold  },
  approved: { Icon: CheckCircle, color: C.green },
  rejected: { Icon: XCircle,     color: C.red   },
};

export default function Balance() {
  const { t } = useLanguage();
  const [user,        setUser]        = useState(null);
  const [activity,    setActivity]    = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [geoRate,     setGeoRate]     = useState(1000);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [activeTab,   setActiveTab]   = useState('visits');

  useEffect(() => {
    Promise.all([
      apiFetch('/api/me').then(r => r.json()),
      apiFetch('/api/activity').then(r => r.json()),
      apiFetch('/api/config').then(r => r.ok ? r.json() : { geoRate: 1000 }).catch(() => ({ geoRate: 1000 })),
      apiFetch('/api/me/withdrawals').then(r => r.json()).catch(() => ({ withdrawals: [] })),
    ])
      .then(([me, act, cfg, wds]) => {
        setUser(me.user);
        setActivity(act.activity || []);
        setGeoRate(cfg.geoRate || 1000);
        setWithdrawals(wds.withdrawals || []);
      })
      .catch(() => setError(t('balance.error')))
      .finally(() => setLoading(false));
  }, []);

  const geoBalance     = user?.balance ?? 0;
  const totalEarnedGeo = activity.reduce((s, v) => s + (v.amount || 0), 0);

  const MONO = {};

  if (error) return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <AlertCircle size={32} color={C.red} strokeWidth={1.5} />
      <div style={{ ...MONO, fontSize: 10, color: C.red, letterSpacing: 1 }}>ОШИБКА ЗАГРУЗКИ</div>
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.3s ease both' }}>

      {/* ── Vault header ── */}
      <div style={{ padding: '16px 16px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ ...MONO, fontSize: 8, color: C.t2, letterSpacing: 2 }}>THE VAULT — GEO WALLET</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, boxShadow: `0 0 5px ${C.green}` }} />
            <span style={{ ...MONO, fontSize: 8, color: C.green, letterSpacing: 1 }}>SYNCED</span>
          </div>
        </div>

        <div style={{ padding: '12px 0 16px' }}>
          <div style={{ ...MONO, fontSize: 9, color: C.t3, letterSpacing: 1.5, marginBottom: 6 }}>TOTAL BALANCE</div>
          {loading ? (
            <div className="sk" style={{ height: 44, width: 160, borderRadius: 3 }} />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <SlotCounter
                  value={geoBalance}
                  loading={loading}
                  style={{ fontFamily: "'Inter', sans-serif", fontSize: 44, fontWeight: 400, letterSpacing: -1, lineHeight: 1, color: C.t1 }}
                />
                <span style={{ ...MONO, fontSize: 16, color: C.geo }}>GEO</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span style={{ ...MONO, fontSize: 11, color: C.t2 }}>
                  ≈ {formatUzs(geoToUzs(geoBalance, geoRate))} UZS
                </span>
                <span style={{ ...MONO, fontSize: 9, color: C.t3, background: C.geoDim, border: `1px solid ${C.geoGl}`, borderRadius: 8, padding: '1px 7px' }}>
                  1 GEO = {geoRate} UZS
                </span>
              </div>
            </>
          )}
        </div>

        {/* 3 action buttons */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 14 }}>
          {[
            { label: 'SEND',    Icon: CreditCard,    to: '/withdraw', primary: true },
            { label: 'HISTORY', Icon: TrendingUp,    tab: 'withdrawals' },
            { label: 'RATE',    Icon: TrendingUp,    info: `${geoRate} UZS` },
          ].map(({ label, Icon, to, tab, primary, info }) => (
            to ? (
              <Link key={label} to={to} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: primary ? C.geo : C.geoDim,
                color: primary ? '#F4EBDD' : C.geo,
                border: primary ? 'none' : `1px solid ${C.geoGl}`,
                borderRadius: 14, padding: '10px 4px',
                textDecoration: 'none',
                fontFamily: "'Inter', sans-serif",
                fontSize: 9, letterSpacing: 1.5,
              }}>
                <Icon size={14} strokeWidth={1.75} />
                {label}
              </Link>
            ) : (
              <button key={label} onClick={() => tab && setActiveTab(tab)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: C.geoDim,
                color: C.geo, border: `1px solid ${C.geoGl}`,
                borderRadius: 14, padding: '10px 4px', cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: 9, letterSpacing: 1.5,
                WebkitTapHighlightColor: 'transparent',
              }}>
                <Icon size={14} strokeWidth={1.75} />
                {info || label}
              </button>
            )
          ))}
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {[
          { key: 'visits',      label: 'LEDGER' },
          { key: 'withdrawals', label: 'WITHDRAWALS', badge: withdrawals.filter(w => w.status === 'pending').length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 0',
            borderBottom: `2px solid ${activeTab === tab.key ? C.geo : 'transparent'}`,
            fontFamily: "'Inter', sans-serif",
            fontSize: 9, letterSpacing: 1.5,
            color: activeTab === tab.key ? C.geo : C.t3,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'border-color 0.18s, color 0.18s',
            WebkitTapHighlightColor: 'transparent',
          }}>
            {tab.label}
            {tab.badge > 0 && (
              <span style={{ background: C.gold, color: C.bg, borderRadius: 2, fontSize: 8, fontWeight: 700, padding: '1px 4px' }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '0 16px 32px' }}>

        {/* Activity / Ledger */}
        {activeTab === 'visits' && (
          <>
            {loading && (
              <div style={{ paddingTop: 8 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="sk" style={{ height: 10, width: 18, borderRadius: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div className="sk" style={{ height: 12, width: '50%', borderRadius: 2, marginBottom: 5 }} />
                      <div className="sk" style={{ height: 9, width: '30%', borderRadius: 2 }} />
                    </div>
                    <div className="sk" style={{ height: 14, width: 50, borderRadius: 2 }} />
                  </div>
                ))}
              </div>
            )}

            {!loading && activity.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ ...MONO, fontSize: 10, color: C.t3, letterSpacing: 2 }}>NO TRANSACTIONS</div>
              </div>
            )}

            {!loading && activity.map((item, i) => {
              const { Icon, color, tag } = activityMeta(item);
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  animation: `fadeUp 0.28s ${E.smooth} both`,
                  animationDelay: `${i * 0.03}s`,
                }}>
                  <span style={{ ...MONO, fontSize: 10, color: C.t3, width: 18, flexShrink: 0, textAlign: 'right' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, flexShrink: 0, background: `${color}14`, borderRadius: 3, border: `1px solid ${color}30` }}>
                    <Icon size={11} color={color} strokeWidth={1.75} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ ...MONO, fontSize: 7, color, background: `${color}14`, borderRadius: 2, padding: '1px 4px', border: `1px solid ${color}30` }}>{tag}</span>
                      <span style={{ ...MONO, fontSize: 8, color: C.t3 }}>{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ ...MONO, fontSize: 13, color: item.amount > 0 ? C.geo : C.red }}>
                      {item.amount > 0 ? '+' : ''}{formatGeo(item.amount)}
                    </div>
                    <div style={{ ...MONO, fontSize: 7, color: C.t3, marginTop: 2 }}>GEO</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Withdrawals */}
        {activeTab === 'withdrawals' && (
          <>
            {loading && (
              <div style={{ paddingTop: 8 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="sk" style={{ height: 10, width: 18, borderRadius: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div className="sk" style={{ height: 12, width: '40%', borderRadius: 2, marginBottom: 5 }} />
                      <div className="sk" style={{ height: 9, width: '55%', borderRadius: 2 }} />
                    </div>
                    <div className="sk" style={{ height: 14, width: 50, borderRadius: 2 }} />
                  </div>
                ))}
              </div>
            )}

            {!loading && withdrawals.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ ...MONO, fontSize: 10, color: C.t3, letterSpacing: 2 }}>NO WITHDRAWALS</div>
              </div>
            )}

            {!loading && withdrawals.map((w, i) => {
              const stIcons = WD_STATUS_ICONS[w.status] || WD_STATUS_ICONS.pending;
              const stLabel = t(`balance.wd.${w.status}`) || t('balance.wd.pending');
              const st = { ...stIcons, label: stLabel };
              return (
                <div key={w.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  animation: `fadeUp 0.28s ${E.smooth} both`,
                  animationDelay: `${i * 0.03}s`,
                }}>
                  <span style={{ ...MONO, fontSize: 10, color: C.t3, width: 18, flexShrink: 0, textAlign: 'right' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                      <st.Icon size={11} color={st.color} strokeWidth={2} />
                      <span style={{ ...MONO, fontSize: 9, color: st.color, letterSpacing: 1 }}>{st.label.toUpperCase()}</span>
                    </div>
                    <span style={{ ...MONO, fontSize: 8, color: C.t3 }}>{formatDate(w.created_at)}</span>
                    {w.phone && <span style={{ ...MONO, fontSize: 8, color: C.t3, marginLeft: 8 }}>{w.phone}</span>}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ ...MONO, fontSize: 13, color: w.status === 'rejected' ? C.t3 : C.red, textDecoration: w.status === 'rejected' ? 'line-through' : 'none' }}>
                      -{formatGeo(w.amount)}
                    </div>
                    <div style={{ ...MONO, fontSize: 7, color: C.t3, marginTop: 2 }}>GEO</div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
