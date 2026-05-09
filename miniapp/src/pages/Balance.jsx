import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, TrendingUp, Map, Calendar, CreditCard, AlertCircle, Clock, CheckCircle, XCircle, ArrowDownCircle } from 'lucide-react';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { geoToUzs, formatGeo, formatUzs } from '../lib/geo';
import { C, G, E, sk, cardBase } from '../lib/design';

function formatDate(str) {
  return new Date(str).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function SkeletonRow() {
  const shimmer = {
    background: `linear-gradient(90deg, ${C.card} 0%, rgba(255,255,255,0.06) 50%, ${C.card} 100%)`,
    backgroundSize: '600px 100%',
    animation: 'shimmer 1.6s ease-in-out infinite',
  };
  return (
    <div style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '14px 16px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ flex: 1 }}>
        <div style={{ ...sk(14, 140, 6), ...shimmer, marginBottom: 8 }} />
        <div style={{ ...sk(10, 90, 5), ...shimmer }} />
      </div>
      <div style={{ ...sk(22, 84, 8), ...shimmer }} />
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
  pending:  { label: 'Ожидает',  Icon: Clock,         color: '#f59e0b' },
  approved: { label: 'Одобрено', Icon: CheckCircle,   color: '#00e676' },
  rejected: { label: 'Отклонено', Icon: XCircle,      color: '#ff5252' },
};

export default function Balance() {
  const [user,        setUser]        = useState(null);
  const [visits,      setVisits]      = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [geoRate,     setGeoRate]     = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [activeTab,   setActiveTab]   = useState('visits');

  useEffect(() => {
    const h = { initdata: initData };
    Promise.all([
      fetch(`${API_BASE}/api/me`,             { headers: h }).then(r => r.json()),
      fetch(`${API_BASE}/api/visits`,          { headers: h }).then(r => r.json()),
      fetch(`${API_BASE}/api/config`).then(r => r.json()).catch(() => ({ geoRate: 1 })),
      fetch(`${API_BASE}/api/me/withdrawals`,  { headers: h }).then(r => r.json()).catch(() => ({ withdrawals: [] })),
    ])
      .then(([me, vis, cfg, wds]) => {
        setUser(me.user);
        setVisits(vis.visits || []);
        setGeoRate(cfg.geoRate || 1);
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
      <AlertCircle size={52} color={C.red} strokeWidth={1.5} />
      <div style={{ color: C.red, fontWeight: 600 }}>{error}</div>
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.4s ease both' }}>
      {/* Wallet hero */}
      <div style={{
        background: G.hero,
        padding: '36px 22px 60px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(42,171,238,0.14) 0%, transparent 70%)',
          pointerEvents: 'none', animation: 'glowPulse 4s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -40,
          width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,230,118,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Coins size={14} color={C.geo} strokeWidth={2} />
          GEO Wallet
        </div>

        {loading ? (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, height: 52, width: 220, animation: 'pulse 1.4s infinite', marginBottom: 10 }} />
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, height: 18, width: 130, animation: 'pulse 1.4s infinite' }} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 54, fontWeight: 900, letterSpacing: -2, lineHeight: 1, color: C.t1 }}>
                {formatGeo(shownBalance)}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.t3, marginBottom: 7 }}>GEO</div>
            </div>
            <div style={{ fontSize: 17, color: C.t3, fontWeight: 500 }}>
              ≈ {formatUzs(geoToUzs(shownBalance, geoRate))} UZS
            </div>
            {geoRate !== 1 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: C.blueFt, border: `1px solid ${C.blueGl}`,
                borderRadius: 20, padding: '4px 12px', marginTop: 14,
                fontSize: 12, color: C.blue, fontWeight: 700,
              }}>
                <TrendingUp size={12} color={C.blue} />
                1 GEO = {geoRate} UZS
              </div>
            )}
          </>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', marginTop: 28 }}>
          {[
            { label: 'Визитов',    val: loading ? '—' : visits.length },
            { label: 'Заработано', val: loading ? '—' : `${formatGeo(totalEarnedGeo)} GEO` },
          ].map((item, i) => (
            <div key={i} style={{
              flex: 1,
              paddingRight: i === 0 ? 18 : 0,
              borderRight: i === 0 ? `1px solid ${C.b1}` : 'none',
              paddingLeft: i === 1 ? 18 : 0,
            }}>
              <div style={{ fontSize: 11, color: C.t3, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.6 }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.t1 }}>{item.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content panel */}
      <div style={{
        marginTop: -24, borderRadius: '28px 28px 0 0',
        background: C.bg, border: `1px solid ${C.b0}`, borderBottom: 'none',
        minHeight: '60vh', paddingTop: 22,
      }}>
        {/* Withdraw CTA */}
        <div style={{ padding: '0 16px 18px' }}>
          <Link to="/withdraw" style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
            background: G.blue,
            color: '#fff', textDecoration: 'none',
            borderRadius: 18, padding: '17px 20px',
            fontWeight: 800, fontSize: 16,
            boxShadow: `0 8px 28px ${C.blueGl}`,
            animation: 'fadeUp 0.35s ease both',
          }}>
            <CreditCard size={20} color="#fff" strokeWidth={2} />
            Вывести GEO → UZS
          </Link>
        </div>

        {/* Tab switcher */}
        <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8 }}>
          {[
            { key: 'visits',      label: 'Активность' },
            { key: 'withdrawals', label: 'Выводы', badge: withdrawals.filter(w => w.status === 'pending').length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 12,
                border: activeTab === tab.key ? `1.5px solid ${C.blue}` : `1px solid ${C.b1}`,
                background: activeTab === tab.key ? C.blueFt : C.card,
                color: activeTab === tab.key ? C.blue : C.t3,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.18s',
              }}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span style={{
                  background: '#f59e0b', color: '#000',
                  borderRadius: 10, fontSize: 10, fontWeight: 800,
                  padding: '1px 6px', lineHeight: 1.4,
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 16px' }}>
          {/* Visits tab */}
          {activeTab === 'visits' && (
            <>
              {loading && [1, 2, 3].map(i => <SkeletonRow key={i} />)}

              {!loading && visits.length === 0 && (
                <div style={{ textAlign: 'center', padding: '56px 16px' }}>
                  <Map size={64} color={C.t3} strokeWidth={1.25} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.35 }} />
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: C.t1 }}>Нет активности</div>
                  <div style={{ color: C.t3, fontSize: 14, lineHeight: 1.6 }}>
                    Сканируйте QR-коды в заведениях,<br />чтобы получать GEO
                  </div>
                </div>
              )}

              {!loading && visits.map((v, i) => (
                <div key={v.id} style={{
                  ...cardBase,
                  border: `1px solid ${C.b1}`,
                  padding: '14px 16px', marginBottom: 10,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  animation: `fadeUp 0.35s ${E.smooth} both`,
                  animationDelay: `${i * 0.04}s`,
                }}>
                  <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.t1 }}>
                      {v.business_name || 'Заведение'}
                    </div>
                    <div style={{ fontSize: 12, color: C.t3, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={11} color={C.t3} />
                      {formatDate(v.created_at)}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ color: C.geo, fontWeight: 800, fontSize: 16 }}>
                      +{formatGeo(v.rewarded)} GEO
                    </div>
                    <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                      ≈ {formatUzs(geoToUzs(v.rewarded, geoRate))} UZS
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Withdrawals tab */}
          {activeTab === 'withdrawals' && (
            <>
              {loading && [1, 2].map(i => <SkeletonRow key={i} />)}

              {!loading && withdrawals.length === 0 && (
                <div style={{ textAlign: 'center', padding: '56px 16px' }}>
                  <ArrowDownCircle size={64} color={C.t3} strokeWidth={1.25} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.35 }} />
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: C.t1 }}>Нет заявок</div>
                  <div style={{ color: C.t3, fontSize: 14, lineHeight: 1.6 }}>
                    Заявки на вывод появятся здесь
                  </div>
                </div>
              )}

              {!loading && withdrawals.map((w, i) => {
                const st = WD_STATUS[w.status] || WD_STATUS.pending;
                return (
                  <div key={w.id} style={{
                    ...cardBase,
                    border: `1px solid ${C.b1}`,
                    padding: '14px 16px', marginBottom: 10,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    animation: `fadeUp 0.35s ${E.smooth} both`,
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
                      <div style={{ color: w.status === 'rejected' ? C.t3 : C.t1, fontWeight: 800, fontSize: 16, textDecoration: w.status === 'rejected' ? 'line-through' : 'none' }}>
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
    </div>
  );
}
