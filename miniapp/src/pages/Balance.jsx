import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, AlertCircle, Clock, CheckCircle, XCircle,
  Loader2, QrCode, Target, CreditCard, BarChart3, Zap,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { geoToUzs, formatGeo, formatUzs } from '../lib/geo';
import { C, E } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';

// ── Easing ────────────────────────────────────────────────────────────────────
const EASE_OUT = 'cubic-bezier(0.23,1,0.32,1)';
const EASE_SPRING = 'cubic-bezier(0.32,0.72,0,1)';

// ── Rarity + type meta ────────────────────────────────────────────────────────
const RARITY_STYLE = {
  common:    { color: '#10B981', bg: '#10B98112', border: '#10B98128' },
  rare:      { color: '#3B82F6', bg: '#3B82F612', border: '#3B82F628' },
  epic:      { color: '#A855F7', bg: '#A855F712', border: '#A855F728' },
  legendary: { color: '#F59E0B', bg: '#F59E0B12', border: '#F59E0B28' },
};

function activityMeta(item, t) {
  if (item.type === 'promo') {
    const r = RARITY_STYLE[item.rarity] || RARITY_STYLE.common;
    return { Icon: QrCode, color: r.color, bg: r.bg, border: r.border, tag: 'Promo' };
  }
  if (item.type === 'geohunt') {
    return { Icon: Target, color: '#FF8C00', bg: '#FF8C0012', border: '#FF8C0028', tag: 'GeoHunt' };
  }
  return { Icon: MapPin, color: C.geo, bg: C.geoDim, border: C.geoGl, tag: t('balance.tag.visit') };
}

function formatDate(str) {
  return new Date(str).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Slot counter — digit-by-digit animation ───────────────────────────────────
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
      <span style={{ display: 'block', animation: `slotDrop 0.46s cubic-bezier(0.22,1,0.36,1) ${delay}ms both` }}>
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

// ── Withdrawal status ─────────────────────────────────────────────────────────
const WD_STATUS = {
  pending:  { Icon: Clock,        color: C.gold,  label: 'pending'  },
  approved: { Icon: CheckCircle,  color: C.green, label: 'approved' },
  rejected: { Icon: XCircle,      color: C.red,   label: 'rejected' },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skel({ h = 14, w = '100%', r = 6 }) {
  return <div className="sk" style={{ height: h, width: w, borderRadius: r, flexShrink: 0 }} />;
}

// ── Action button with press state ────────────────────────────────────────────
function ActionBtn({ label, Icon, primary, onClick, to, info }) {
  const [pressed, setPressed] = useState(false);
  const pressProps = {
    onTouchStart: () => setPressed(true), onTouchEnd: () => setPressed(false),
    onMouseDown:  () => setPressed(true), onMouseUp:  () => setPressed(false),
    onMouseLeave: () => setPressed(false),
  };
  const style = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
    borderRadius: 18, padding: '14px 8px',
    textDecoration: 'none', cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    transform: pressed ? 'scale(0.96)' : 'scale(1)',
    transition: pressed
      ? `transform 100ms ${EASE_OUT}`
      : `transform 180ms ${EASE_SPRING}`,
    ...(primary ? {
      background: 'linear-gradient(135deg, #D48A52 0%, #C97B47 55%, #B36835 100%)',
      border: 'none',
      boxShadow: '0 4px 18px rgba(201,123,71,0.28)',
    } : {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
    }),
  };

  const content = (
    <>
      <Icon size={17} color={primary ? '#0A0E14' : C.t2} strokeWidth={primary ? 2.25 : 1.75} />
      <span style={{
        fontSize: 10, fontWeight: primary ? 700 : 600,
        color: primary ? '#0A0E14' : C.t2,
        letterSpacing: -0.2, lineHeight: 1,
      }}>
        {info || label}
      </span>
    </>
  );

  if (to) {
    return <Link to={to} style={style} {...pressProps}>{content}</Link>;
  }
  return (
    <button onClick={onClick} style={style} {...pressProps}>{content}</button>
  );
}

// ── Transaction row ───────────────────────────────────────────────────────────
function TxRow({ item, index, t }) {
  const { Icon, color, bg, border, tag } = activityMeta(item, t);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '13px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      animation: `staggerIn 0.28s ${EASE_OUT} ${index * 0.04}s both`,
    }}>
      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 13, flexShrink: 0,
        background: bg, border: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={17} color={color} strokeWidth={1.75} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: C.t1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 3, letterSpacing: -0.2,
        }}>
          {item.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color,
            background: bg, border: `1px solid ${border}`,
            borderRadius: 5, padding: '1px 6px', letterSpacing: 0.3,
          }}>
            {tag}
          </span>
          <span style={{ fontSize: 11, color: C.t3 }}>{formatDate(item.created_at)}</span>
        </div>
      </div>

      {/* Amount */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{
          fontSize: 15, fontWeight: 700, letterSpacing: -0.3,
          color: item.amount > 0 ? C.geo : C.red,
        }}>
          {item.amount > 0 ? '+' : ''}{formatGeo(item.amount)}
        </div>
        <div style={{ fontSize: 9, color: C.t3, marginTop: 2, fontWeight: 500 }}>GEO</div>
      </div>
    </div>
  );
}

// ── Withdrawal row ────────────────────────────────────────────────────────────
function WdRow({ item, index, t }) {
  const st = WD_STATUS[item.status] || WD_STATUS.pending;
  const label = t(`balance.wd.${item.status}`) || t('balance.wd.pending');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '13px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      animation: `staggerIn 0.28s ${EASE_OUT} ${index * 0.04}s both`,
    }}>
      {/* Status icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 13, flexShrink: 0,
        background: `${st.color}12`, border: `1px solid ${st.color}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <st.Icon size={17} color={st.color} strokeWidth={1.75} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: `${st.color}12`, border: `1px solid ${st.color}25`,
          borderRadius: 6, padding: '3px 8px', marginBottom: 4,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: st.color, letterSpacing: 0.2 }}>
            {label.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.t3 }}>
          {formatDate(item.created_at)}
          {item.phone && <span style={{ marginLeft: 8 }}>{item.phone}</span>}
        </div>
      </div>

      {/* Amount */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{
          fontSize: 15, fontWeight: 700, letterSpacing: -0.3,
          color: item.status === 'rejected' ? C.t3 : C.red,
          textDecoration: item.status === 'rejected' ? 'line-through' : 'none',
        }}>
          −{formatGeo(item.amount)}
        </div>
        <div style={{ fontSize: 9, color: C.t3, marginTop: 2, fontWeight: 500 }}>GEO</div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Balance() {
  const { t } = useLanguage();
  const [user,        setUser]        = useState(null);
  const [activity,    setActivity]    = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [geoRate,     setGeoRate]     = useState(1000);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [activeTab,   setActiveTab]   = useState('visits');
  const [tabKey,      setTabKey]      = useState(0);

  function switchTab(tab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setTabKey(k => k + 1);
  }

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
  const pendingCount   = withdrawals.filter(w => w.status === 'pending').length;

  if (error) return (
    <div style={{
      background: C.bg, minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16, padding: '0 32px',
    }}>
      <AlertCircle size={28} color={C.red} strokeWidth={1.5} style={{ opacity: 0.7 }} />
      <div style={{ fontSize: 14, color: C.t3, textAlign: 'center', lineHeight: 1.5 }}>
        {t('balance.error')}
      </div>
    </div>
  );

  const tabs = [
    { key: 'visits',      label: t('balance.tab.ledger') },
    { key: 'withdrawals', label: t('balance.tab.wd_label'), badge: pendingCount },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.35s cubic-bezier(0.22,1,0.36,1) both' }}>

      {/* ── Balance hero card ── */}
      <div style={{ padding: '16px 16px 0' }}>

        {/* Double-bezel card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 26, padding: 1.5, marginBottom: 14,
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #0D1B28 0%, #081018 100%)',
            borderRadius: 25, padding: '22px 20px',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Ambient glow — top right corner */}
            <div style={{
              position: 'absolute', top: -50, right: -30,
              width: 180, height: 180, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,123,71,0.09) 0%, transparent 68%)',
              pointerEvents: 'none',
            }} />

            {/* Top row: wallet label + live indicator */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 20,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.t3, letterSpacing: 0.2 }}>
                GEO Wallet
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', background: C.green,
                  boxShadow: `0 0 6px ${C.green}`,
                  animation: 'pulse 2.5s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: C.green, letterSpacing: 0.2 }}>
                  {t('balance.synced')}
                </span>
              </div>
            </div>

            {/* Balance label */}
            <div style={{
              fontSize: 10, color: C.t3, fontWeight: 500,
              letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
            }}>
              {t('balance.total_balance')}
            </div>

            {/* Large balance number */}
            {loading ? (
              <Skel h={52} w={180} r={10} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                <SlotCounter
                  value={geoBalance}
                  loading={loading}
                  style={{
                    fontSize: 50, fontWeight: 300,
                    letterSpacing: -2, lineHeight: 1, color: C.t1,
                  }}
                />
                <span style={{
                  fontSize: 17, fontWeight: 600, color: C.geo, letterSpacing: -0.5,
                }}>
                  GEO
                </span>
              </div>
            )}

            {/* UZS conversion */}
            {!loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: C.t3, fontWeight: 400 }}>
                  ≈ {formatUzs(geoToUzs(geoBalance, geoRate))} UZS
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: C.geo,
                  background: C.geoDim, border: `1px solid ${C.geoGl}`,
                  borderRadius: 20, padding: '2px 8px', letterSpacing: 0.3,
                }}>
                  1 GEO = {geoRate.toLocaleString('ru-RU')} UZS
                </span>
              </div>
            )}

            {/* Earned stat — bottom of card */}
            {!loading && totalEarnedGeo > 0 && (
              <div style={{
                marginTop: 18,
                paddingTop: 16,
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 11, color: C.t3 }}>{t('balance.earned')}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.geo, letterSpacing: -0.3 }}>
                  +{formatGeo(totalEarnedGeo)} GEO
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons — 3 column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          <ActionBtn
            label={t('balance.btn.send')}
            Icon={CreditCard}
            primary
            to="/withdraw"
          />
          <ActionBtn
            label={t('balance.btn.history')}
            Icon={BarChart3}
            onClick={() => switchTab('withdrawals')}
          />
          <ActionBtn
            label={t('balance.btn.rate')}
            Icon={Zap}
            info={`${geoRate.toLocaleString('ru-RU')}`}
          />
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div style={{
        display: 'flex', padding: '4px 16px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => switchTab(tab.key)} style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            padding: '11px 0',
            borderBottom: `2px solid ${activeTab === tab.key ? C.geo : 'transparent'}`,
            transition: `border-color 0.22s ${EASE_OUT}, color 0.18s`,
            fontSize: 12, fontWeight: activeTab === tab.key ? 700 : 500,
            letterSpacing: -0.2,
            color: activeTab === tab.key ? C.t1 : C.t3,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            WebkitTapHighlightColor: 'transparent',
          }}>
            {tab.label}
            {tab.badge > 0 && (
              <span style={{
                background: C.gold, color: '#0A0E14',
                borderRadius: 10, fontSize: 9, fontWeight: 800,
                padding: '1px 5px', lineHeight: 1.4,
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content — keyed so React remounts on tab switch, triggering staggerIn ── */}
      <div key={tabKey} style={{ padding: '0 16px 80px', animation: 'fadeUp 0.22s cubic-bezier(0.22,1,0.36,1) both' }}>

        {/* Activity / Ledger */}
        {activeTab === 'visits' && (
          <>
            {loading && (
              <div style={{ paddingTop: 4 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="sk" style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <Skel h={13} w="52%" r={6} />
                      <div style={{ marginTop: 5 }}><Skel h={10} w="34%" r={5} /></div>
                    </div>
                    <Skel h={16} w={58} r={7} />
                  </div>
                ))}
              </div>
            )}

            {!loading && activity.length === 0 && (
              <div style={{ textAlign: 'center', padding: '56px 0 24px' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 17,
                  background: C.geoDim, border: `1px solid ${C.geoGl}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <MapPin size={24} color={C.geo} strokeWidth={1.75} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t2, marginBottom: 6 }}>
                  {t('balance.empty.visits.title')}
                </div>
                <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.55, maxWidth: 240, margin: '0 auto' }}>
                  {t('balance.empty.visits.text')}
                </div>
              </div>
            )}

            {!loading && activity.map((item, i) => (
              <TxRow key={item.id} item={item} index={i} t={t} />
            ))}
          </>
        )}

        {/* Withdrawals */}
        {activeTab === 'withdrawals' && (
          <>
            {loading && (
              <div style={{ paddingTop: 4 }}>
                {[1, 2].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="sk" style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <Skel h={13} w="40%" r={6} />
                      <div style={{ marginTop: 5 }}><Skel h={10} w="52%" r={5} /></div>
                    </div>
                    <Skel h={16} w={58} r={7} />
                  </div>
                ))}
              </div>
            )}

            {!loading && withdrawals.length === 0 && (
              <div style={{ textAlign: 'center', padding: '56px 0 24px' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 17,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <CreditCard size={24} color={C.t3} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t2, marginBottom: 6 }}>
                  {t('balance.empty.wd.title')}
                </div>
                <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.55 }}>
                  {t('balance.empty.wd.text')}
                </div>
              </div>
            )}

            {!loading && withdrawals.map((w, i) => (
              <WdRow key={w.id} item={w} index={i} t={t} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
