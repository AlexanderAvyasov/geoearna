import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';

const ANIM = `
  @keyframes fadeUp { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
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
  const [user, setUser] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const h = { initdata: initData };
    Promise.all([
      fetch(`${API_BASE}/api/me`, { headers: h }).then(r => r.json()),
      fetch(`${API_BASE}/api/visits`, { headers: h }).then(r => r.json()),
    ])
      .then(([me, vis]) => {
        setUser(me.user);
        setVisits(vis.visits || []);
      })
      .catch(() => setError('Не удалось загрузить данные.'))
      .finally(() => setLoading(false));
  }, []);

  const totalEarned = visits.reduce((s, v) => s + (v.rewarded || 0), 0);

  if (error) return (
    <div style={{ padding: 32, textAlign: 'center', paddingTop: 80 }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>😕</div>
      <div style={{ color: '#FF3B30', fontWeight: 600 }}>{error}</div>
    </div>
  );

  return (
    <div>
      <style>{ANIM}</style>

      {/* Balance Hero */}
      <div style={{
        background: 'linear-gradient(150deg, #2AABEE 0%, #1a8fcc 100%)',
        padding: '28px 20px 44px',
        color: '#fff',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Ваш баланс
        </div>
        {loading ? (
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, height: 48, width: 180, animation: 'pulse 1.4s infinite' }} />
        ) : (
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, lineHeight: 1, animation: 'fadeUp 0.3s ease' }}>
            {(user?.balance ?? 0).toLocaleString()}
            <span style={{ fontSize: 20, fontWeight: 500, opacity: 0.85, marginLeft: 8 }}>сум</span>
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>Визитов</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{loading ? '—' : visits.length}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>Заработано</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{loading ? '—' : `${totalEarned.toLocaleString()} сум`}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ marginTop: -20, borderRadius: '20px 20px 0 0', background: '#EFEFF4', minHeight: '60vh', paddingTop: 20 }}>

        {/* Withdraw button */}
        <div style={{ padding: '0 16px 16px' }}>
          <Link to="/withdraw" style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
            color: '#fff', textDecoration: 'none',
            borderRadius: 14, padding: '15px 20px',
            fontWeight: 700, fontSize: 16,
            boxShadow: '0 4px 16px rgba(42,171,238,0.35)',
          }}>
            <span style={{ fontSize: 18 }}>💳</span> Вывести средства
          </Link>
        </div>

        {/* History header */}
        <div style={{
          padding: '0 16px 12px',
          fontSize: 13, fontWeight: 700, color: '#8E8E93',
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          История визитов
        </div>

        <div style={{ padding: '0 16px' }}>
          {loading && [1, 2, 3].map(i => <SkeletonRow key={i} />)}

          {!loading && visits.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <div style={{ fontSize: 60, marginBottom: 14 }}>🗺️</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Нет визитов</div>
              <div style={{ color: '#8E8E93', fontSize: 14, lineHeight: 1.6 }}>
                Сканируйте QR-коды в заведениях,<br />чтобы получать вознаграждение
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
                <div style={{
                  fontWeight: 600, fontSize: 15, marginBottom: 4,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {v.business_name || 'Заведение'}
                </div>
                <div style={{ fontSize: 12, color: '#8E8E93' }}>
                  📅 {formatDate(v.created_at)}
                </div>
              </div>
              <div style={{
                color: '#34C759', fontWeight: 800, fontSize: 16,
                flexShrink: 0, whiteSpace: 'nowrap',
              }}>
                +{v.rewarded.toLocaleString()} сум
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
