import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { geoToUzs, formatGeo, formatUzs } from '../lib/geo';

const ANIM = `
  @keyframes fadeUp { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes countUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
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
        <div style={{ background: '#F2F2F7', borderRadius: 6, height: 14, width: 120, marginBottom: 8, animation: 'pulse 1.4s infinite' }} />
        <div style={{ background: '#F2F2F7', borderRadius: 6, height: 11, width: 80, animation: 'pulse 1.4s infinite' }} />
      </div>
      <div style={{ background: '#F2F2F7', borderRadius: 8, height: 20, width: 70, alignSelf: 'center', animation: 'pulse 1.4s infinite' }} />
    </div>
  );
}

export default function Balance() {
  const [user, setUser]       = useState(null);
  const [visits, setVisits]   = useState([]);
  const [geoRate, setGeoRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    const h = { initdata: initData };
    Promise.all([
      fetch(`${API_BASE}/api/me`, { headers: h }).then(r => r.json()),
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

  const geoBalance  = user?.balance ?? 0;
  const uzsBalance  = geoToUzs(geoBalance, geoRate);
  const totalEarnedGeo = visits.reduce((s, v) => s + (v.rewarded || 0), 0);

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>😕</div>
      <div style={{ color: '#FF3B30', fontWeight: 600 }}>{error}</div>
    </div>
  );

  return (
    <div>
      <style>{ANIM}</style>

      {/* Wallet Hero */}
      <div style={{
        background: 'linear-gradient(150deg, #1C1C1E 0%, #2C2C2E 100%)',
        padding: '28px 20px 52px',
        color: '#fff',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
          💎 GEO Wallet
        </div>

        {loading ? (
          <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, height: 52, width: 200, animation: 'pulse 1.4s infinite' }} />
        ) : (
          <>
            <div style={{ animation: 'countUp 0.4s ease' }}>
              <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1 }}>
                {formatGeo(geoBalance)}
                <span style={{ fontSize: 22, fontWeight: 600, opacity: 0.7, marginLeft: 8 }}>GEO</span>
              </div>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginTop: 6, fontWeight: 500 }}>
                ≈ {formatUzs(uzsBalance)} UZS
              </div>
            </div>

            {/* Rate badge */}
            {geoRate !== 1 && (
              <div style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '4px 10px',
                fontSize: 12, color: 'rgba(255,255,255,0.6)',
                marginTop: 10, fontWeight: 600,
              }}>
                1 GEO = {geoRate} UZS
              </div>
            )}
          </>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Визитов</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{loading ? '—' : visits.length}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.15)' }} />
          <div>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Заработано</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{loading ? '—' : `${formatGeo(totalEarnedGeo)} GEO`}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: -24, borderRadius: '24px 24px 0 0', background: '#EFEFF4', minHeight: '60vh', paddingTop: 20 }}>

        {/* Withdraw button */}
        <div style={{ padding: '0 16px 16px' }}>
          <Link to="/withdraw" style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
            color: '#fff', textDecoration: 'none',
            borderRadius: 16, padding: '16px 20px',
            fontWeight: 800, fontSize: 16,
            boxShadow: '0 4px 18px rgba(42,171,238,0.4)',
          }}>
            <span style={{ fontSize: 20 }}>💳</span>
            Вывести GEO → UZS
          </Link>
        </div>

        {/* Activity history */}
        <div style={{ padding: '0 16px 12px', fontSize: 13, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          История активности
        </div>

        <div style={{ padding: '0 16px' }}>
          {loading && [1, 2, 3].map(i => <SkeletonRow key={i} />)}

          {!loading && visits.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <div style={{ fontSize: 60, marginBottom: 14 }}>🗺️</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Нет активности</div>
              <div style={{ color: '#8E8E93', fontSize: 14, lineHeight: 1.6 }}>
                Сканируйте QR-коды в заведениях,<br />чтобы получать GEO
              </div>
            </div>
          )}

          {!loading && visits.map((v, i) => (
            <div key={v.id} style={{
              background: '#fff', borderRadius: 14,
              padding: '14px 16px', marginBottom: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              animation: 'fadeUp 0.3s ease both',
              animationDelay: `${i * 0.04}s`,
            }}>
              <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
