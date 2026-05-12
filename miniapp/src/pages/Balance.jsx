import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, MapPin, Calendar, CreditCard, AlertCircle, Clock, CheckCircle, XCircle, ArrowDownCircle, Loader2, QrCode, Target } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { geoToUzs, formatGeo, formatUzs } from '../lib/geo';
import { C, E, cardBase } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';

const BC = { fontFamily: "'Barlow Condensed', sans-serif" };

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

  if (error) return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <AlertCircle size={48} color={C.red} strokeWidth={1.5} />
      <div style={{ color: C.red, fontWeight: 600 }}>{error}</div>
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.35s ease both' }}>
      {/* Hero */}
      <div style={{ padding: '44px 22px 28px', position: 'relative' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Wallet size={12} color={C.geo} strokeWidth={2} />
          GEO Wallet
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '20px 0' }}>
            <Loader2 size={32} color={C.geo} style={{ animation: 'spin 1s linear infinite', opacity: 0.7 }} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
              <SlotCounter
                value={geoBalance}
                loading={loading}
                style={{ ...BC, fontSize: 52, fontWeight: 700, letterSpacing: -2, lineHeight: 1, color: C.t1 }}
              />
              <div style={{ fontSize: 20, fontWeight: 600, color: C.t3, marginBottom: 6 }}>GEO</div>
            </div>
            <div style={{ fontSize: 16, color: C.t3, fontWeight: 500 }}>
              ≈ {formatUzs(geoToUzs(geoBalance, geoRate))} UZS
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: C.geoDim, border: `0.5px solid ${C.geoGl}`,
              borderRadius: 20, padding: '4px 12px', marginTop: 12,
              fontSize: 12, color: C.geo, fontWeight: 600,
            }}>
              <TrendingUp size={11} color={C.geo} />
              1 GEO = {geoRate} UZS
            </div>
          </>
        )}

        {/* Stats */}
        {!loading && (
          <div style={{ display: 'flex', marginTop: 24, paddingTop: 20, borderTop: `0.5px solid ${C.b1}` }}>
            {[
              { label: t('balance.visits'), val: activity.length },
              { label: t('balance.earned'), val: `${formatGeo(totalEarnedGeo)} GEO` },
            ].map((item, i) => (
              <div key={i} style={{
                flex: 1,
                paddingRight: i === 0 ? 18 : 0,
                borderRight: i === 0 ? `0.5px solid ${C.b1}` : 'none',
                paddingLeft: i === 1 ? 18 : 0,
              }}>
                <div style={{ fontSize: 10, color: C.t3, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
                <div style={{ ...BC, fontSize: 20, fontWeight: 700, color: C.t1 }}>{item.val}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: '0.5px', background: C.b1, marginBottom: 0 }} />

      {/* Content */}
      <div style={{ padding: '16px 16px 32px' }}>
        {/* Withdraw CTA */}
        <Link to="/withdraw" style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
          background: C.geo,
          color: C.bg, textDecoration: 'none',
          borderRadius: 14, padding: '15px 20px',
          fontWeight: 700, fontSize: 16,
          marginBottom: 16,
          animation: 'fadeUp 0.35s ease both',
          position: 'relative', overflow: 'hidden',
          letterSpacing: 0.5,
        }}>
          <CreditCard size={18} color={C.bg} strokeWidth={2} />
          {t('balance.withdraw_cta')}
        </Link>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: C.card, borderRadius: 12, padding: 4 }}>
          {[
            { key: 'visits',      label: t('balance.tab.activity') },
            { key: 'withdrawals', label: t('balance.tab.withdrawals'), badge: withdrawals.filter(w => w.status === 'pending').length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 9,
                border: 'none',
                background: activeTab === tab.key ? C.cardHi : 'transparent',
                color: activeTab === tab.key ? C.t1 : C.t3,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.18s',
                outline: 'none',
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: 0.4,
              }}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span style={{
                  background: C.gold, color: C.bg,
                  borderRadius: 8, fontSize: 10, fontWeight: 800,
                  padding: '1px 5px', lineHeight: 1.4,
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Activity */}
        {activeTab === 'visits' && (
          <>
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                <Loader2 size={28} color={C.t3} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            {!loading && activity.length === 0 && (
              <div style={{ textAlign: 'center', padding: '56px 16px' }}>
                <MapPin size={52} color={C.t3} strokeWidth={1.25} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.25 }} />
                <div style={{ ...BC, fontWeight: 700, fontSize: 18, marginBottom: 8, color: C.t1 }}>{t('balance.empty.visits.title')}</div>
                <div style={{ color: C.t3, fontSize: 14, lineHeight: 1.65 }}>
                  {t('balance.empty.visits.text').split('\n').map((l, i) => <span key={i}>{l}{i === 0 && <br />}</span>)}
                </div>
              </div>
            )}

            {!loading && activity.map((item, i) => {
              const { Icon, color, bg, border, tag } = activityMeta(item);
              return (
                <div key={item.id} style={{
                  ...cardBase,
                  border: `0.5px solid ${C.b1}`,
                  padding: '14px 16px', marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  animation: `fadeUp 0.32s ${E.smooth} both`,
                  animationDelay: `${i * 0.04}s`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, paddingRight: 12 }}>
                    <div style={{
                      flexShrink: 0, width: 34, height: 34, borderRadius: 9,
                      background: bg, border: `0.5px solid ${border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={16} color={color} strokeWidth={1.75} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.t1 }}>
                          {item.title}
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                          color, background: bg, border: `0.5px solid ${border}`,
                          borderRadius: 4, padding: '1px 5px', flexShrink: 0,
                        }}>
                          {tag}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: C.t3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={10} color={C.t3} />
                        {formatDate(item.created_at)}
                      </div>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{
                      color, fontWeight: 800, fontSize: 14,
                      background: bg, borderRadius: 9, padding: '5px 10px',
                      border: `0.5px solid ${border}`,
                      fontFamily: "'Barlow Condensed', sans-serif",
                      letterSpacing: 0.3,
                    }}>
                      +{formatGeo(item.amount)} GEO
                    </div>
                    <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>
                      ≈ {formatUzs(geoToUzs(item.amount, geoRate))} UZS
                    </div>
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
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                <Loader2 size={28} color={C.t3} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            {!loading && withdrawals.length === 0 && (
              <div style={{ textAlign: 'center', padding: '56px 16px' }}>
                <ArrowDownCircle size={52} color={C.t3} strokeWidth={1.25} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.25 }} />
                <div style={{ ...BC, fontWeight: 700, fontSize: 18, marginBottom: 8, color: C.t1 }}>{t('balance.empty.wd.title')}</div>
                <div style={{ color: C.t3, fontSize: 14, lineHeight: 1.65 }}>
                  {t('balance.empty.wd.text')}
                </div>
              </div>
            )}

            {!loading && withdrawals.map((w, i) => {
              const stIcons = WD_STATUS_ICONS[w.status] || WD_STATUS_ICONS.pending;
              const stLabel = t(`balance.wd.${w.status}`) || t('balance.wd.pending');
              const st = { ...stIcons, label: stLabel };
              return (
                <div key={w.id} style={{
                  ...cardBase,
                  border: `0.5px solid ${C.b1}`,
                  padding: '14px 16px', marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  animation: `fadeUp 0.32s ${E.smooth} both`,
                  animationDelay: `${i * 0.04}s`,
                }}>
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: `${st.color}18`, borderRadius: 8,
                      padding: '3px 8px', marginBottom: 5,
                    }}>
                      <st.Icon size={12} color={st.color} strokeWidth={2.5} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.t3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={11} color={C.t3} />
                      {formatDate(w.created_at)}
                    </div>
                    {w.phone && (
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>{w.phone}</div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{
                      color: w.status === 'rejected' ? C.t3 : C.t1,
                      fontWeight: 700, fontSize: 15,
                      textDecoration: w.status === 'rejected' ? 'line-through' : 'none',
                      fontFamily: "'Barlow Condensed', sans-serif",
                    }}>
                      -{formatGeo(w.amount)} GEO
                    </div>
                    <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                      ≈ {formatUzs(geoToUzs(w.amount, geoRate))} UZS
                    </div>
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
