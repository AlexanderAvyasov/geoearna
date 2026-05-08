import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { geoToUzs, formatGeo, formatUzs } from '../lib/geo';

const ANIM = `
  @keyframes fadeUp  { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes slideIn { from{transform:translateX(-10px);opacity:0} to{transform:translateX(0);opacity:1} }
`;

function formatDate(str) {
  return new Date(str).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function SkeletonRow() {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
      <div>
        <div style={{ background: '#F2F2F7', borderRadius: 6, height: 14, width: 130, marginBottom: 8, animation: 'pulse 1.4s infinite' }} />
        <div style={{ background: '#F2F2F7', borderRadius: 6, height: 11, width: 80, animation: 'pulse 1.4s infinite' }} />
      </div>
      <div style={{ background: '#F2F2F7', borderRadius: 8, height: 22, width: 80, alignSelf: 'center', animation: 'pulse 1.4s infinite' }} />
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

export default function Balance() {
  const [user,    setUser]    = useState(null);
  const [visits,  setVisits]  = useState([]);
  const [geoRate, setGeoRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const h = { initdata: initData };
    Promise.all([
      fetch(`${API_BASE}/api/me`,     { headers: h }).then(r => r.json()),
      fetch(`${API_BASE}/api/visits`, { headers: h }).then(r => r.json()),
      fetch(`${API_BASE}/api/config`).then(r => r.json()).catch(() => ({ geoRate: 1 })),
    ])
      .then(([me, vis, cfg]) => {
        setUser(me.user);
        setVisits(vis.visits || []);
        setGeoRate(cfg.geoRate || 1);
      })
      .catch(() => setError('Не удалось загрузить данные.'))
      .finally(() => setLoading(false));
  }, []);

  const geoBalance      = user?.balance ?? 0;
  const uzsBalance      = geoToUzs(geoBalance, geoRate);
  const totalEarnedGeo  = visits.reduce((s, v) => s + (v.rewarded || 0), 0);

  const displayBalance = useCountUp(geoBalance, !loading && geoBalance > 0);
  const shownBalance   = loading ? 0 : (geoBalance > 0 ? displayBalance : 0);

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>😕</div>
      <div style={{ color: '#FF3B30', fontWeight: 600 }}>{error}</div>
    </div>
  );

  return (
    <div>
      <style>{ANIM}</style>

      {/* Dark wallet hero */}
      <div style={{
        background: 'linear-gradient(150deg, #0D1117 0%, #161E2E 60%, #0D1117 100%)',
        padding: '32px 20px 56px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative glow */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(42,171,238,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
          💎 GEO Wallet
        </div>

        {loading ? (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, height: 52, width: 200, animation: 'pulse 1.4s infinite', marginBottom: 10 }} />
            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, height: 18, width: 120, animation: 'pulse 1.4s infinite' }} />
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -2, lineHeight: 1, color: '#fff' }}>
                {formatGeo(shownBalance)}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                GEO
              </div>
            </div>
            <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
              ≈ {formatUzs(geoToUzs(shownBalance, geoRate))} UZS
            </div>

            {geoRate !== 1 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(42,171,238,0.12)', border: '1px solid rgba(42,171,238,0.25)',
                borderRadius: 20, padding: '4px 12px',
                fontSize: 12, color: '#2AABEE', marginTop: 12, fontWeight: 700,
              }}>
                📈 1 GEO = {geoRate} UZS
              </div>
            )}
          </>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 0, marginTop: 24 }}>
          {[
            { label: 'Визитов', val: loading ? '—' : visits.length },
            { label: 'Заработано', val: loading ? '—' : `${formatGeo(totalEarnedGeo)} GEO` },
          ].map((item, i) => (
            <div key={i} style={{ flex: 1, paddingRight: i === 0 ? 16 : 0, borderRight: i === 0 ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingLeft: i === 1 ? 16 : 0 }}>
              <div style={{ fontSize: 11, opacity: 0.4, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{item.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: -28, borderRadius: '28px 28px 0 0', background: '#EFEFF4', minHeight: '60vh', paddingTop: 20 }}>

        {/* Withdraw button */}
        <div style={{ padding: '0 16px 16px' }}>
          <Link to="/withdraw" style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
            color: '#fff', textDecoration: 'none',
            borderRadius: 18, padding: '17px 20px',
            fontWeight: 800, fontSize: 16,
            boxShadow: '0 6px 24px rgba(42,171,238,0.38)',
            animation: 'fadeUp 0.3s ease both',
          }}>
            <span style={{ fontSize: 20 }}>💳</span>
            Вывести GEO → UZS
          </Link>
        </div>

        {/* Activity header */}
        <div style={{ padding: '4px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            История активности
          </div>
          {!loading && visits.length > 0 && (
            <div style={{ fontSize: 12, color: '#8E8E93', fontWeight: 600 }}>
              {visits.length} записей
            </div>
          )}
        </div>

        <div style={{ padding: '0 16px' }}>
          {loading && [1, 2, 3].map(i => <SkeletonRow key={i} />)}

          {!loading && visits.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 16px' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🗺️</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: '#1C1C1E' }}>Нет активности</div>
              <div style={{ color: '#8E8E93', fontSize: 14, lineHeight: 1.6 }}>
                Сканируйте QR-коды в заведениях,<br />чтобы получать GEO
              </div>
            </div>
          )}

          {!loading && visits.map((v, i) => (
            <div key={v.id} style={{
              background: '#fff', borderRadius: 16,
              padding: '14px 16px', marginBottom: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              animation: `fadeUp 0.3s ${i * 0.04}s ease both`,
            }}>
              <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1C1C1E' }}>
                  {v.business_name || 'Заведение'}
                </div>
                <div style={{ fontSize: 12, color: '#8E8E93' }}>
                  📅 {formatDate(v.created_at)}
                </div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ color: '#34C759', fontWeight: 800, fontSize: 16 }}>
                  +{formatGeo(v.rewarded)} GEO
                </div>
                <div style={{ fontSize: 11, color: '#C7C7CC', marginTop: 2 }}>
                  ≈ {formatUzs(geoToUzs(v.rewarded, geoRate))} UZS
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
