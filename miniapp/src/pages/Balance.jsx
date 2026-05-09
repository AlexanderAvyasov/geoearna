import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, TrendingUp, MapPin, Calendar, CreditCard, AlertCircle, Clock, CheckCircle, XCircle, ArrowDownCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { geoToUzs, formatGeo, formatUzs } from '../lib/geo';
import { C, E, cardBase } from '../lib/design';

const SYNE = { fontFamily: "'Syne', sans-serif" };

function formatDate(str) {
  return new Date(str).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function SkeletonRow() {
  return (
    <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '14px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sk" style={{ height: 14, width: 140, borderRadius: 6, marginBottom: 8 }} />
        <div className="sk" style={{ height: 10, width: 90, borderRadius: 5 }} />
      </div>
      <div className="sk" style={{ height: 22, width: 84, borderRadius: 8 }} />
    </div>
  );
}

function useCountUp(target, running) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!running || !target) return;
    const duration = 700;
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, running]);

  return value;
}

const WD_STATUS = {
  pending:  { label: 'Ожидает',   Icon: Clock,       color: C.gold   },
  approved: { label: 'Одобрено',  Icon: CheckCircle, color: C.green  },
  rejected: { label: 'Отклонено', Icon: XCircle,     color: C.red    },
};

export default function Balance() {
  const [user,        setUser]        = useState(null);
  const [visits,      setVisits]      = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [geoRate,     setGeoRate]     = useState(1000);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [activeTab,   setActiveTab]   = useState('visits');

  useEffect(() => {
    Promise.all([
      apiFetch('/api/me').then(r => r.json()),
      apiFetch('/api/visits').then(r => r.json()),
      apiFetch('/api/config').then(r => r.ok ? r.json() : { geoRate: 1000 }).catch(() => ({ geoRate: 1000 })),
      apiFetch('/api/me/withdrawals').then(r => r.json()).catch(() => ({ withdrawals: [] })),
    ])
      .then(([me, vis, cfg, wds]) => {
        setUser(me.user);
        setVisits(vis.visits || []);
        setGeoRate(cfg.geoRate || 1000);
        setWithdrawals(wds.withdrawals || []);
      })
      .catch(() => setError('Не удалось загрузить данные.'))
      .finally(() => setLoading(false));
  }, []);

  const geoBalance     = user?.balance ?? 0;
  const totalEarnedGeo = visits.reduce((s, v) => s + (v.rewarded || 0), 0);
  const displayBalance = useCountUp(geoBalance, !loading && geoBalance > 0);
  const shownBalance   = loading ? 0 : (geoBalance > 0 ? displayBalance : 0);

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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div className="sk" style={{ height: 50, width: 180, borderRadius: 10 }} />
            <div className="sk" style={{ height: 16, width: 110, borderRadius: 6 }} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 6 }}>
              <div style={{ ...SYNE, fontSize: 52, fontWeight: 700, letterSpacing: -2, lineHeight: 1, color: C.t1 }}>
                {formatGeo(shownBalance)}
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: C.t3, marginBottom: 6 }}>GEO</div>
            </div>
            <div style={{ fontSize: 16, color: C.t3, fontWeight: 500 }}>
              ≈ {formatUzs(geoToUzs(shownBalance, geoRate))} UZS
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
        <div style={{ display: 'flex', marginTop: 24, paddingTop: 20, borderTop: `0.5px solid ${C.b1}` }}>
          {[
            { label: 'Визитов',    val: loading ? '—' : visits.length },
            { label: 'Заработано', val: loading ? '—' : `${formatGeo(totalEarnedGeo)} GEO` },
          ].map((item, i) => (
            <div key={i} style={{
              flex: 1,
              paddingRight: i === 0 ? 18 : 0,
              borderRight: i === 0 ? `0.5px solid ${C.b1}` : 'none',
              paddingLeft: i === 1 ? 18 : 0,
            }}>
              <div style={{ fontSize: 10, color: C.t3, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</div>
              <div style={{ ...SYNE, fontSize: 20, fontWeight: 700, color: C.t1 }}>{item.val}</div>
            </div>
          ))}
        </div>
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
          fontWeight: 700, fontSize: 15,
          marginBottom: 16,
          animation: 'fadeUp 0.35s ease both',
        }}>
          <CreditCard size={18} color={C.bg} strokeWidth={2} />
          Вывести GEO → UZS
        </Link>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: C.card, borderRadius: 12, padding: 4 }}>
          {[
            { key: 'visits',      label: 'Активность' },
            { key: 'withdrawals', label: 'Выводы', badge: withdrawals.filter(w => w.status === 'pending').length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 9,
                border: 'none',
                background: activeTab === tab.key ? C.cardHi : 'transparent',
                color: activeTab === tab.key ? C.t1 : C.t3,
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.18s',
                outline: 'none',
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

        {/* Visits */}
        {activeTab === 'visits' && (
          <>
            {loading && [1, 2, 3].map(i => <SkeletonRow key={i} />)}

            {!loading && visits.length === 0 && (
              <div style={{ textAlign: 'center', padding: '56px 16px' }}>
                <MapPin size={52} color={C.t3} strokeWidth={1.25} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.25 }} />
                <div style={{ ...SYNE, fontWeight: 700, fontSize: 18, marginBottom: 8, color: C.t1 }}>Нет активности</div>
                <div style={{ color: C.t3, fontSize: 14, lineHeight: 1.65 }}>
                  Сканируйте QR-коды в заведениях,<br />чтобы получать GEO
                </div>
              </div>
            )}

            {!loading && visits.map((v, i) => (
              <div key={v.id} style={{
                ...cardBase,
                border: `0.5px solid ${C.b1}`,
                padding: '14px 16px', marginBottom: 8,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                animation: `fadeUp 0.32s ${E.smooth} both`,
                animationDelay: `${i * 0.04}s`,
              }}>
                <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.t1 }}>
                    {v.business_name || 'Заведение'}
                  </div>
                  <div style={{ fontSize: 12, color: C.t3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={11} color={C.t3} />
                    {formatDate(v.created_at)}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{
                    color: C.geo, fontWeight: 700, fontSize: 14,
                    background: C.geoDim, borderRadius: 9, padding: '5px 10px',
                    border: `0.5px solid ${C.geoGl}`,
                  }}>
                    +{formatGeo(v.rewarded)} GEO
                  </div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>
                    ≈ {formatUzs(geoToUzs(v.rewarded, geoRate))} UZS
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Withdrawals */}
        {activeTab === 'withdrawals' && (
          <>
            {loading && [1, 2].map(i => <SkeletonRow key={i} />)}

            {!loading && withdrawals.length === 0 && (
              <div style={{ textAlign: 'center', padding: '56px 16px' }}>
                <ArrowDownCircle size={52} color={C.t3} strokeWidth={1.25} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.25 }} />
                <div style={{ ...SYNE, fontWeight: 700, fontSize: 18, marginBottom: 8, color: C.t1 }}>Нет заявок</div>
                <div style={{ color: C.t3, fontSize: 14, lineHeight: 1.65 }}>
                  Заявки на вывод появятся здесь
                </div>
              </div>
            )}

            {!loading && withdrawals.map((w, i) => {
              const st = WD_STATUS[w.status] || WD_STATUS.pending;
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
