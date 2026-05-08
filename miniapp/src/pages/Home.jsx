import { useEffect, useState } from 'react';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';

const ANIM = `
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes fadeUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
`;

function SkeletonCard() {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ background: '#F2F2F7', borderRadius: 6, height: 16, width: '60%', marginBottom: 10, animation: 'pulse 1.4s ease-in-out infinite' }} />
        <div style={{ background: '#F2F2F7', borderRadius: 6, height: 12, width: '40%', animation: 'pulse 1.4s ease-in-out infinite' }} />
      </div>
      <div style={{ background: '#F2F2F7', borderRadius: 10, height: 36, width: 90, marginLeft: 12, animation: 'pulse 1.4s ease-in-out infinite' }} />
    </div>
  );
}

function CampaignCard({ campaign }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: '16px',
      marginBottom: 12,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      animation: 'fadeUp 0.3s ease both',
    }}>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
        <div style={{
          fontWeight: 700, fontSize: 16,
          marginBottom: 5, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {campaign.business_name}
        </div>
        <div style={{
          fontSize: 13, color: '#8E8E93',
          display: 'flex', alignItems: 'center', gap: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <span>📍</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {campaign.address || 'Адрес не указан'}
          </span>
        </div>
      </div>
      <div style={{
        background: 'linear-gradient(135deg, #34C759, #25a244)',
        color: '#fff',
        borderRadius: 12,
        padding: '9px 13px',
        fontSize: 13,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        boxShadow: '0 3px 10px rgba(52,199,89,0.35)',
      }}>
        +{campaign.reward_amount.toLocaleString()} сум
      </div>
    </div>
  );
}

export default function Home() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/campaigns`, { headers: { initdata: initData } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => setError('Не удалось загрузить предложения.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <style>{ANIM}</style>

      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(150deg, #2AABEE 0%, #1a8fcc 100%)',
        padding: '24px 20px 36px',
        color: '#fff',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.75, letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>
          Добро пожаловать
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>GeoEarn 📍</div>
        <div style={{ fontSize: 14, opacity: 0.8, lineHeight: 1.5 }}>
          Посещайте заведения и получайте вознаграждение за каждый визит
        </div>
      </div>

      {/* Cards section */}
      <div style={{
        marginTop: -16,
        borderRadius: '20px 20px 0 0',
        background: '#EFEFF4',
        minHeight: '70vh',
        paddingTop: 20,
      }}>
        <div style={{
          padding: '0 16px 12px',
          fontSize: 13,
          fontWeight: 700,
          color: '#8E8E93',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          Активные кампании
        </div>

        <div style={{ padding: '0 16px' }}>
          {loading && [1, 2, 3].map(i => <SkeletonCard key={i} />)}

          {!loading && error && (
            <div style={{ textAlign: 'center', paddingTop: 48 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>😕</div>
              <div style={{ fontWeight: 600, fontSize: 16, color: '#FF3B30', marginBottom: 6 }}>
                Ошибка загрузки
              </div>
              <div style={{ color: '#8E8E93', fontSize: 14 }}>{error}</div>
            </div>
          )}

          {!loading && !error && campaigns.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 48 }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🏪</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Нет активных кампаний</div>
              <div style={{ color: '#8E8E93', fontSize: 14, lineHeight: 1.6 }}>
                Пока нет заведений с активными акциями.<br />Загляните позже!
              </div>
            </div>
          )}

          {!loading && !error && campaigns.map((c, i) => (
            <div key={c.id} style={{ animationDelay: `${i * 0.05}s` }}>
              <CampaignCard campaign={c} />
            </div>
          ))}
        </div>

        {/* How it works */}
        {!loading && !error && campaigns.length > 0 && (
          <div style={{ margin: '8px 16px 0', padding: '16px', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#1C1C1E' }}>Как это работает</div>
            {[
              ['📱', 'Получите QR-код в заведении'],
              ['📍', 'Разрешите доступ к геолокации'],
              ['💰', 'Получите вознаграждение на баланс'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 14, color: '#3C3C3E' }}>{text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
