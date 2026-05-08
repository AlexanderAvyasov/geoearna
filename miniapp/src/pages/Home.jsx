import { useEffect, useState } from 'react';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { haversineMeters, formatDistance, formatGeo } from '../lib/geo';

const ANIM = `
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes fadeUp { from{transform:translateY(14px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes slideUp{ from{transform:translateY(100%)} to{transform:translateY(0)} }
  @keyframes backdrop{ from{opacity:0} to{opacity:1} }
`;

const TASK_LABEL = { visit: '📍 Визит', purchase: '🛍 Покупка', review: '⭐ Отзыв' };

function SkeletonCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ flex: 1 }}>
        <div style={{ background: '#F2F2F7', borderRadius: 6, height: 15, width: '60%', marginBottom: 10, animation: 'pulse 1.4s ease-in-out infinite' }} />
        <div style={{ background: '#F2F2F7', borderRadius: 6, height: 11, width: '35%', animation: 'pulse 1.4s ease-in-out infinite' }} />
      </div>
      <div style={{ background: '#F2F2F7', borderRadius: 10, height: 36, width: 90, marginLeft: 12, animation: 'pulse 1.4s ease-in-out infinite' }} />
    </div>
  );
}

function CampaignSheet({ campaign, userPos, onClose }) {
  const dist = userPos && campaign.lat && campaign.lng
    ? haversineMeters(userPos, { lat: +campaign.lat, lng: +campaign.lng })
    : null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.48)', zIndex: 200, animation: 'backdrop 0.25s ease' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '0 0 36px', zIndex: 201,
        maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E0E0E0', margin: '12px auto 20px' }} />
        <div style={{ padding: '0 24px' }}>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4, color: '#1C1C1E' }}>
            {campaign.business_name}
          </div>
          {campaign.address && (
            <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: dist !== null ? 4 : 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📍</span><span>{campaign.address}</span>
            </div>
          )}
          {dist !== null && (
            <div style={{ fontSize: 13, color: '#2AABEE', fontWeight: 700, marginBottom: 20 }}>
              🧭 {formatDistance(dist)} от вас
            </div>
          )}

          <div style={{
            background: 'linear-gradient(135deg, #34C759, #25a244)',
            borderRadius: 18, padding: '22px',
            color: '#fff', textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 5, fontWeight: 600 }}>Вознаграждение за визит</div>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -1.5 }}>
              +{formatGeo(campaign.reward_amount)}
              <span style={{ fontSize: 18, fontWeight: 700, opacity: 0.9, marginLeft: 8 }}>GEO</span>
            </div>
          </div>

          <div style={{ background: '#F2F2F7', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#8E8E93', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
              Тип задания
            </div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {TASK_LABEL[campaign.task_type] || '📍 Визит'}
            </div>
            {campaign.task_description && (
              <div style={{ fontSize: 14, color: '#3C3C3E', lineHeight: 1.5, marginTop: 6 }}>
                {campaign.task_description}
              </div>
            )}
          </div>

          {campaign.requires_pin && (
            <div style={{
              background: 'rgba(255,149,0,0.08)', border: '1.5px solid rgba(255,149,0,0.25)',
              borderRadius: 12, padding: '12px 14px', marginBottom: 12,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>🔐</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#CC7A00', marginBottom: 2 }}>Требуется PIN</div>
                <div style={{ fontSize: 13, color: '#8E8E93', lineHeight: 1.4 }}>
                  Попросите сотрудника назвать PIN при чекине
                </div>
              </div>
            </div>
          )}

          <div style={{ background: '#F2F2F7', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#8E8E93', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
              Как получить
            </div>
            {[
              ['📷', 'Отсканируйте QR-код в заведении'],
              ['📍', 'Разрешите доступ к геолокации'],
              ['💎', 'GEO зачислятся мгновенно'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 17, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 13, color: '#3C3C3E' }}>{text}</span>
              </div>
            ))}
          </div>

          <button onClick={onClose} style={{
            width: '100%', background: '#F2F2F7', border: 'none',
            borderRadius: 14, padding: '15px', fontSize: 16,
            fontWeight: 700, color: '#3C3C3E', cursor: 'pointer',
          }}>
            Закрыть
          </button>
        </div>
      </div>
    </>
  );
}

function CampaignCard({ campaign, onTap }) {
  const [pressed, setPressed] = useState(false);

  return (
    <div
      onClick={() => onTap(campaign)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        background: '#fff', borderRadius: 16, padding: '15px 16px',
        marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)', cursor: 'pointer',
        transform: pressed ? 'scale(0.975)' : 'scale(1)',
        transition: 'transform 0.15s ease',
        userSelect: 'none', WebkitUserSelect: 'none',
        animation: 'fadeUp 0.3s ease both',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1C1C1E' }}>
          {campaign.business_name}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {campaign.dist !== undefined && campaign.dist !== Infinity && (
            <span style={{ fontSize: 12, color: '#2AABEE', fontWeight: 600 }}>
              🧭 {formatDistance(campaign.dist)}
            </span>
          )}
          {campaign.address && !campaign.dist && (
            <span style={{ fontSize: 12, color: '#8E8E93', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📍 {campaign.address}
            </span>
          )}
          {campaign.requires_pin && (
            <span style={{ fontSize: 11, color: '#FF9500', fontWeight: 600 }}>🔐 PIN</span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{
          background: 'linear-gradient(135deg, #34C759, #25a244)',
          color: '#fff', borderRadius: 12, padding: '9px 13px',
          fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
          boxShadow: '0 3px 10px rgba(52,199,89,0.35)',
        }}>
          +{formatGeo(campaign.reward_amount)} GEO
        </div>
        <div style={{ fontSize: 11, color: '#C7C7CC', marginTop: 4 }}>Подробнее →</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [selected,  setSelected]  = useState(null);
  const [userPos,   setUserPos]   = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/campaigns`, { headers: { initdata: initData } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => setError('Не удалось загрузить предложения.'))
      .finally(() => setLoading(false));
  }, []);

  // Non-blocking location for distance sorting
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { maximumAge: 60000, timeout: 10000 }
    );
  }, []);

  const displayed = (() => {
    if (!userPos) return campaigns;
    return [...campaigns]
      .map(c => ({
        ...c,
        dist: c.lat && c.lng ? haversineMeters(userPos, { lat: +c.lat, lng: +c.lng }) : Infinity,
      }))
      .sort((a, b) => a.dist - b.dist);
  })();

  return (
    <div>
      <style>{ANIM}</style>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(150deg, #0D1117 0%, #1a2744 100%)',
        padding: '28px 20px 40px',
        color: '#fff',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.4, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
          GeoEarn · Discover
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, lineHeight: 1.1 }}>
          Зарабатывайте GEO 💎
        </div>
        <div style={{ fontSize: 14, opacity: 0.55, lineHeight: 1.5, maxWidth: 280 }}>
          Посещайте заведения и получайте GEO-монеты за каждый визит
        </div>
        {userPos && !loading && displayed.length > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(52,199,89,0.15)', border: '1px solid rgba(52,199,89,0.3)',
            borderRadius: 20, padding: '5px 12px', marginTop: 14,
            fontSize: 12, color: '#34C759', fontWeight: 700,
          }}>
            🧭 Сортировка по расстоянию
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ marginTop: -16, borderRadius: '20px 20px 0 0', background: '#EFEFF4', minHeight: '70vh', paddingTop: 18 }}>
        <div style={{ padding: '0 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Активные кампании
          </div>
          {!loading && displayed.length > 0 && (
            <div style={{ fontSize: 12, color: '#8E8E93', fontWeight: 600 }}>
              {displayed.length} {displayed.length === 1 ? 'заведение' : displayed.length < 5 ? 'заведения' : 'заведений'}
            </div>
          )}
        </div>

        <div style={{ padding: '0 16px' }}>
          {loading && [1, 2, 3].map(i => <SkeletonCard key={i} />)}

          {!loading && error && (
            <div style={{ textAlign: 'center', paddingTop: 48 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>😕</div>
              <div style={{ fontWeight: 600, fontSize: 16, color: '#FF3B30', marginBottom: 6 }}>Ошибка загрузки</div>
              <div style={{ color: '#8E8E93', fontSize: 14 }}>{error}</div>
            </div>
          )}

          {!loading && !error && displayed.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 48 }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🏪</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: '#1C1C1E' }}>Нет активных кампаний</div>
              <div style={{ color: '#8E8E93', fontSize: 14, lineHeight: 1.6 }}>
                Пока нет заведений с активными акциями.<br />Загляните позже!
              </div>
            </div>
          )}

          {!loading && !error && displayed.map((c, i) => (
            <div key={c.id} style={{ animationDelay: `${i * 0.05}s` }}>
              <CampaignCard campaign={c} onTap={setSelected} />
            </div>
          ))}
        </div>

        {!loading && !error && displayed.length > 0 && (
          <div style={{ margin: '8px 16px 28px', padding: '16px', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#1C1C1E' }}>Как это работает</div>
            {[
              ['📷', 'Нажмите 📷 и отсканируйте QR-код в заведении'],
              ['📍', 'Разрешите доступ к геолокации'],
              ['💎', 'GEO-монеты зачислятся мгновенно'],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: 14, color: '#3C3C3E' }}>{text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <CampaignSheet campaign={selected} userPos={userPos} onClose={() => setSelected(null)} />}
    </div>
  );
}
