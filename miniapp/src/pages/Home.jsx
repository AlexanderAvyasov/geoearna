import { useEffect, useState } from 'react';
import { MapPin, Compass, ScanLine, Wallet, Lock, ShoppingBag, Star, AlertCircle, Store, ChevronRight, Zap } from 'lucide-react';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { haversineMeters, formatDistance, formatGeo } from '../lib/geo';
import { C, G, E, cardBase, pressable } from '../lib/design';

const TASK_ICONS = {
  visit:    MapPin,
  purchase: ShoppingBag,
  review:   Star,
};
const TASK_LABELS = {
  visit:    'Визит',
  purchase: 'Покупка',
  review:   'Отзыв',
};

function SkeletonCard() {
  const shimmer = {
    background: `linear-gradient(90deg, ${C.card} 0%, rgba(255,255,255,0.05) 50%, ${C.card} 100%)`,
    backgroundSize: '800px 100%',
    animation: 'shimmer 1.6s ease-in-out infinite',
  };
  return (
    <div style={{ ...cardBase, padding: '16px 18px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ flex: 1 }}>
        <div style={{ background: C.cardHi, borderRadius: 6, height: 14, width: '60%', marginBottom: 10, ...shimmer }} />
        <div style={{ background: C.cardHi, borderRadius: 6, height: 10, width: '35%', ...shimmer }} />
      </div>
      <div style={{ background: C.cardHi, borderRadius: 12, height: 38, width: 100, marginLeft: 14, ...shimmer }} />
    </div>
  );
}

function CampaignSheet({ campaign, userPos, onClose }) {
  const dist = userPos && campaign.lat && campaign.lng
    ? haversineMeters(userPos, { lat: +campaign.lat, lng: +campaign.lng })
    : null;

  const TaskIcon = TASK_ICONS[campaign.task_type] || MapPin;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 200, animation: 'backdropIn 0.22s ease',
        }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.surf,
        borderRadius: '28px 28px 0 0',
        border: `1px solid rgba(255,255,255,0.08)`,
        borderBottom: 'none',
        padding: '0 0 40px',
        zIndex: 201,
        maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -12px 60px rgba(0,0,0,0.7)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 24px' }} />

        <div style={{ padding: '0 22px' }}>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4, color: C.t1, letterSpacing: -0.5 }}>
            {campaign.business_name}
          </div>

          {campaign.address && (
            <div style={{ fontSize: 14, color: C.t3, marginBottom: dist !== null ? 4 : 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={13} color={C.t3} />
              <span>{campaign.address}</span>
            </div>
          )}

          {dist !== null && (
            <div style={{ fontSize: 13, color: C.purpleL, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Compass size={13} color={C.purpleL} />
              {formatDistance(dist)} от вас
            </div>
          )}

          {/* Reward hero */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(99,102,241,0.10) 100%)',
            border: `1.5px solid rgba(124,58,237,0.25)`,
            borderRadius: 20, padding: '22px',
            textAlign: 'center', marginBottom: 14,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -20, right: -20,
              width: 100, height: 100, borderRadius: '50%',
              background: 'rgba(124,58,237,0.08)',
              pointerEvents: 'none',
            }} />
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Вознаграждение
            </div>
            <div style={{ fontSize: 48, fontWeight: 900, letterSpacing: -1.5, color: C.t1 }}>
              +{formatGeo(campaign.reward_amount)}
              <span style={{ fontSize: 18, fontWeight: 700, color: C.purpleL, marginLeft: 8 }}>GEO</span>
            </div>
          </div>

          {/* Task type */}
          <div style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              Тип задания
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.t1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TaskIcon size={16} color={C.purple} strokeWidth={2} />
              {TASK_LABELS[campaign.task_type] || 'Визит'}
            </div>
            {campaign.task_description && (
              <div style={{ fontSize: 14, color: C.t2, lineHeight: 1.5, marginTop: 6 }}>
                {campaign.task_description}
              </div>
            )}
          </div>

          {/* PIN required */}
          {campaign.requires_pin && (
            <div style={{
              background: C.goldFt, border: `1.5px solid rgba(245,158,11,0.2)`,
              borderRadius: 14, padding: '12px 14px', marginBottom: 10,
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <Lock size={17} color={C.gold} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.gold, marginBottom: 2 }}>Требуется PIN</div>
                <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.4 }}>
                  Попросите сотрудника назвать PIN при чекине
                </div>
              </div>
            </div>
          )}

          {/* How to earn */}
          <div style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
              Как получить
            </div>
            {[
              [ScanLine, 'Отсканируйте QR-код в заведении'],
              [MapPin,   'Разрешите доступ к геолокации'],
              [Wallet,   'GEO зачислятся мгновенно'],
            ].map(([Icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <Icon size={16} color={C.purple} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.t2 }}>{text}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            style={{
              width: '100%', background: C.card,
              border: `1px solid ${C.b1}`,
              borderRadius: 16, padding: '15px',
              fontSize: 16, fontWeight: 700,
              color: C.t2, cursor: 'pointer',
            }}
          >
            Закрыть
          </button>
        </div>
      </div>
    </>
  );
}

function CampaignCard({ campaign, onTap, index }) {
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
        ...cardBase,
        padding: '15px 16px',
        marginBottom: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        border: `1px solid rgba(255,255,255,0.07)`,
        cursor: 'pointer',
        ...pressable(pressed),
        animation: `fadeUp 0.32s ${E.smooth} both`,
        animationDelay: `${index * 0.05}s`,
        userSelect: 'none', WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.t1 }}>
          {campaign.business_name}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {campaign.dist !== undefined && campaign.dist !== Infinity && (
            <span style={{ fontSize: 12, color: C.purpleL, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Compass size={11} color={C.purpleL} />
              {formatDistance(campaign.dist)}
            </span>
          )}
          {campaign.address && campaign.dist === undefined && (
            <span style={{ fontSize: 12, color: C.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
              <MapPin size={11} color={C.t3} />
              {campaign.address}
            </span>
          )}
          {campaign.requires_pin && (
            <span style={{
              fontSize: 10, color: C.gold, fontWeight: 700,
              background: C.goldFt, borderRadius: 6, padding: '2px 6px',
              border: `1px solid rgba(245,158,11,0.2)`,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <Lock size={9} color={C.gold} /> PIN
            </span>
          )}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{
          background: 'rgba(124,58,237,0.15)',
          border: `1px solid rgba(124,58,237,0.25)`,
          color: C.purpleL, borderRadius: 12, padding: '9px 13px',
          fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
        }}>
          +{formatGeo(campaign.reward_amount)} GEO
        </div>
        <div style={{ fontSize: 11, color: C.t3, marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
          Подробнее <ChevronRight size={10} color={C.t3} />
        </div>
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
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.35s ease both' }}>
      {/* Hero */}
      <div style={{
        background: G.hero,
        padding: '34px 20px 54px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glows */}
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
          pointerEvents: 'none', animation: 'glowPulse 5s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: -40,
          width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, letterSpacing: 1.8, marginBottom: 12, textTransform: 'uppercase' }}>
          GeoEarn · Discover
        </div>
        <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 8, lineHeight: 1.1, letterSpacing: -0.8, color: C.t1, display: 'flex', alignItems: 'center', gap: 10 }}>
          Зарабатывайте GEO
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(124,58,237,0.15)',
            border: '1px solid rgba(124,58,237,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={18} color={C.purpleL} strokeWidth={2} />
          </div>
        </div>
        <div style={{ fontSize: 14, color: C.t3, lineHeight: 1.65, maxWidth: 280 }}>
          Посещайте заведения и получайте GEO‑монеты за каждый визит
        </div>

        {userPos && !loading && displayed.length > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: C.purpleFt, border: `1px solid rgba(124,58,237,0.2)`,
            borderRadius: 20, padding: '5px 12px', marginTop: 16,
            fontSize: 12, color: C.purpleL, fontWeight: 700,
          }}>
            <Compass size={12} color={C.purpleL} />
            По расстоянию от вас
          </div>
        )}
      </div>

      {/* Content panel */}
      <div style={{
        marginTop: -22, borderRadius: '26px 26px 0 0',
        background: C.bg,
        border: `1px solid rgba(255,255,255,0.05)`,
        borderBottom: 'none',
        minHeight: '70vh',
        paddingTop: 20,
      }}>
        <div style={{ padding: '0 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1 }}>
            Активные кампании
          </div>
          {!loading && displayed.length > 0 && (
            <div style={{
              fontSize: 11, color: C.purpleL, fontWeight: 700,
              background: C.purpleFt, borderRadius: 8, padding: '3px 8px',
            }}>
              {displayed.length}
            </div>
          )}
        </div>

        <div style={{ padding: '0 16px' }}>
          {loading && [1, 2, 3].map(i => <SkeletonCard key={i} />)}

          {!loading && error && (
            <div style={{ textAlign: 'center', paddingTop: 56 }}>
              <AlertCircle size={52} color={C.red} strokeWidth={1.5} style={{ margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: 16, color: C.red, marginBottom: 6 }}>Ошибка загрузки</div>
              <div style={{ color: C.t3, fontSize: 14 }}>{error}</div>
            </div>
          )}

          {!loading && !error && displayed.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 56, paddingBottom: 24 }}>
              <Store size={60} color={C.t3} strokeWidth={1.25} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: C.t1 }}>Нет активных кампаний</div>
              <div style={{ color: C.t3, fontSize: 14, lineHeight: 1.65 }}>
                Пока нет заведений с активными акциями.<br />Загляните позже!
              </div>
            </div>
          )}

          {!loading && !error && displayed.map((c, i) => (
            <CampaignCard key={c.id} campaign={c} onTap={setSelected} index={i} />
          ))}
        </div>

        {!loading && !error && displayed.length > 0 && (
          <div style={{
            margin: '8px 16px 32px',
            ...cardBase,
            border: `1px solid ${C.b0}`,
            padding: 16,
          }}>
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 12, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Как это работает
            </div>
            {[
              [ScanLine, 'Нажмите сканер и наведите на QR‑код'],
              [MapPin,   'Разрешите доступ к геолокации'],
              [Wallet,   'GEO‑монеты зачислятся мгновенно'],
            ].map(([Icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                  background: C.purpleFt, border: `1px solid rgba(124,58,237,0.15)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} color={C.purple} strokeWidth={1.75} />
                </div>
                <span style={{ fontSize: 14, color: C.t2 }}>{text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <CampaignSheet campaign={selected} userPos={userPos} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
