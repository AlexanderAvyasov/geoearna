import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Navigation, Lock, Store, Map as MapIcon, Crosshair, ShoppingBag, Star, ArrowLeft } from 'lucide-react';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { haversineMeters, formatDistance, formatGeo } from '../lib/geo';
import { C, G, E, cardBase } from '../lib/design';

const TASK_LABEL = { visit: 'Визит', purchase: 'Покупка', review: 'Отзыв' };
const TASK_ICON  = { visit: MapPin, purchase: ShoppingBag, review: Star };

function CampaignSheet({ campaign, userPos, onClose }) {
  const dist = userPos && campaign.lat && campaign.lng
    ? haversineMeters(userPos, { lat: +campaign.lat, lng: +campaign.lng })
    : null;

  const TaskIcon = TASK_ICON[campaign.task_type] || MapPin;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 500, animation: 'backdropIn 0.2s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.surf,
        borderRadius: '28px 28px 0 0',
        border: `1px solid rgba(255,255,255,0.08)`,
        borderBottom: 'none',
        padding: '0 0 44px', zIndex: 501,
        maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -12px 60px rgba(0,0,0,0.8)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 22px' }} />
        <div style={{ padding: '0 22px' }}>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4, color: C.t1, letterSpacing: -0.4 }}>
            {campaign.business_name}
          </div>
          {campaign.address && (
            <div style={{ fontSize: 14, color: C.t3, marginBottom: dist !== null ? 4 : 20, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={13} color={C.t3} />
              {campaign.address}
            </div>
          )}
          {dist !== null && (
            <div style={{ fontSize: 13, color: C.purpleL, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Navigation size={13} color={C.purpleL} />
              {formatDistance(dist)} от вас
            </div>
          )}

          {/* Reward hero */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.14) 0%, rgba(99,102,241,0.08) 100%)',
            border: '1.5px solid rgba(124,58,237,0.22)',
            borderRadius: 18, padding: '20px',
            textAlign: 'center', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>Вознаграждение</div>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -1, color: C.t1 }}>
              +{formatGeo(campaign.reward_amount)}
              <span style={{ fontSize: 18, fontWeight: 600, color: C.purpleL, marginLeft: 6 }}>GEO</span>
            </div>
          </div>

          <div style={{ ...cardBase, border: `1px solid ${C.b0}`, borderRadius: 14, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Тип задания</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.t1, display: 'flex', alignItems: 'center', gap: 7 }}>
              <TaskIcon size={16} color={C.purple} strokeWidth={2} />
              {TASK_LABEL[campaign.task_type] || 'Визит'}
            </div>
          </div>

          {campaign.requires_pin && (
            <div style={{
              background: C.goldFt, border: `1.5px solid rgba(245,158,11,0.2)`,
              borderRadius: 14, padding: '12px 14px', marginBottom: 10,
              display: 'flex', gap: 10, alignItems: 'center',
            }}>
              <Lock size={16} color={C.gold} strokeWidth={2} />
              <span style={{ fontSize: 13, color: C.gold, fontWeight: 600 }}>
                Требуется PIN от сотрудника
              </span>
            </div>
          )}

          <button onClick={onClose} style={{
            width: '100%', marginTop: 8,
            background: C.card, border: `1px solid ${C.b1}`,
            borderRadius: 16, padding: '15px',
            fontSize: 16, fontWeight: 700,
            color: C.t2, cursor: 'pointer',
          }}>
            Закрыть
          </button>
        </div>
      </div>
    </>
  );
}

export default function MapPage() {
  const navigate      = useNavigate();
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const markersRef    = useRef([]);
  const userMarkerRef = useRef(null);

  const [campaigns, setCampaigns] = useState([]);
  const [userPos,   setUserPos]   = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/campaigns`, { headers: { initdata: initData } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = [41.2995, 69.2401];
    const map = L.map(containerRef.current, {
      center, zoom: 13,
      zoomControl: false, attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;
    if (userMarkerRef.current) userMarkerRef.current.remove();

    const icon = L.divIcon({
      html: `<div style="position:relative;width:16px;height:16px;">
        <div style="position:absolute;inset:-12px;border-radius:50%;background:rgba(198,241,53,0.18);animation:userPing 2s ease-out infinite;"></div>
        <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(198,241,53,0.10);animation:userPing 2s ease-out 0.7s infinite;"></div>
        <div style="width:16px;height:16px;border-radius:50%;background:#C6F135;border:2.5px solid #090B10;"></div>
      </div>`,
      className: '', iconSize: [16, 16], iconAnchor: [8, 8],
    });

    userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon, zIndexOffset: 1000 }).addTo(map);
    map.setView([userPos.lat, userPos.lng], 14);
  }, [userPos]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || campaigns.length === 0) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    campaigns.forEach(c => {
      if (!c.lat || !c.lng) return;

      const icon = L.divIcon({
        html: `<div style="
          display:inline-block;
          transform:translate(-50%,-100%);
          background:#C6F135;
          color:#090B10;padding:5px 11px;border-radius:20px;
          font-size:12px;font-weight:800;white-space:nowrap;
          border:1.5px solid rgba(198,241,53,0.3);
          font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          pointer-events:none;
        ">+${formatGeo(c.reward_amount)} GEO</div>`,
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([+c.lat, +c.lng], { icon }).addTo(map);
      marker.on('click', () => setSelected(c));
      markersRef.current.push(marker);
    });
  }, [campaigns]);

  const nearby = (() => {
    const withCoords = campaigns.filter(c => c.lat && c.lng);
    if (!userPos) return withCoords;
    return withCoords
      .map(c => ({ ...c, dist: haversineMeters(userPos, { lat: +c.lat, lng: +c.lng }) }))
      .sort((a, b) => a.dist - b.dist);
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: C.bg }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        background: 'rgba(7,11,20,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0, position: 'relative', zIndex: 20,
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.blue, padding: '4px 8px 4px 0',
          display: 'flex', alignItems: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <ArrowLeft size={22} color={C.blue} strokeWidth={2} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <MapIcon size={18} color={C.purpleL} strokeWidth={1.75} />
          <span style={{ fontWeight: 700, fontSize: 18, color: C.t1 }}>Карта</span>
        </div>
        {!loading && (
          <div style={{
            fontSize: 12, color: C.t3, fontWeight: 600,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 10, padding: '3px 10px',
          }}>
            {nearby.length} {nearby.length === 1 ? 'место' : nearby.length < 5 ? 'места' : 'мест'}
          </div>
        )}
      </div>

      {/* Map */}
      <div style={{ position: 'relative', flex: '0 0 48vh' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: C.surf,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
          }}>
            <MapIcon size={48} color={C.t3} strokeWidth={1.25} style={{ opacity: 0.4 }} />
            <div style={{ color: C.t3, fontSize: 14, fontWeight: 600 }}>Загружаем карту…</div>
          </div>
        )}

        {/* Map controls */}
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['+', '−'].map((sym, i) => (
            <button key={sym} onClick={() => {
              const map = mapRef.current;
              if (map) i === 0 ? map.zoomIn() : map.zoomOut();
            }} style={{
              width: 36, height: 36, borderRadius: 10,
              border: `1px solid rgba(255,255,255,0.08)`,
              background: 'rgba(13,17,23,0.92)', backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
              fontSize: 18, fontWeight: 700, cursor: 'pointer', color: C.t1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{sym}</button>
          ))}
          {userPos && (
            <button onClick={() => mapRef.current?.setView([userPos.lat, userPos.lng], 15)} style={{
              width: 36, height: 36, borderRadius: 10,
              border: `1px solid rgba(124,58,237,0.25)`,
              background: 'rgba(13,17,23,0.92)', backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Crosshair size={18} color={C.purple} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Count badge */}
        {!loading && nearby.length > 0 && (
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 10,
            background: 'rgba(7,11,20,0.90)', backdropFilter: 'blur(8px)',
            border: `1px solid rgba(255,255,255,0.07)`,
            borderRadius: 20, padding: '6px 12px',
            fontSize: 13, fontWeight: 700, color: C.t1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Store size={13} color={C.t3} strokeWidth={2} />
            {nearby.length} {nearby.length === 1 ? 'кампания' : nearby.length < 5 ? 'кампании' : 'кампаний'}
          </div>
        )}
      </div>

      {/* Nearby list */}
      <div style={{ flex: 1, overflowY: 'auto', background: C.bg, paddingBottom: 88 }}>
        <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1 }}>
            {userPos ? 'Рядом с вами' : 'Все заведения'}
          </div>
          {!userPos && !loading && (
            <div style={{ fontSize: 12, color: C.orange, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={12} color={C.orange} />
              Геолокация недоступна
            </div>
          )}
        </div>

        <div style={{ padding: '0 16px' }}>
          {loading && [1, 2, 3].map(i => (
            <div key={i} style={{
              ...cardBase, border: `1px solid ${C.b0}`,
              padding: '14px 16px', marginBottom: 8,
              display: 'flex', justifyContent: 'space-between',
              animation: 'pulse 1.4s infinite',
            }}>
              <div>
                <div style={{ background: C.cardHi, borderRadius: 6, height: 14, width: 130, marginBottom: 8 }} />
                <div style={{ background: C.cardHi, borderRadius: 6, height: 11, width: 70 }} />
              </div>
              <div style={{ background: C.cardHi, borderRadius: 10, height: 36, width: 100, alignSelf: 'center' }} />
            </div>
          ))}

          {!loading && nearby.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <MapPin size={52} color={C.t3} strokeWidth={1.25} style={{ opacity: 0.3, marginBottom: 14 }} />
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: C.t1 }}>Нет кампаний на карте</div>
              <div style={{ color: C.t3, fontSize: 14, lineHeight: 1.6 }}>
                Бизнесы ещё не привязали<br />координаты к заведениям
              </div>
            </div>
          )}

          {!loading && nearby.map((c, i) => {
            const TIcon = TASK_ICON[c.task_type] || MapPin;
            return (
              <div
                key={c.id}
                onClick={() => {
                  setSelected(c);
                  if (mapRef.current && c.lat && c.lng) {
                    mapRef.current.setView([+c.lat, +c.lng], 16);
                  }
                }}
                style={{
                  ...cardBase,
                  border: `1px solid rgba(255,255,255,0.06)`,
                  padding: '14px 16px', marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer',
                  animation: `fadeUp 0.32s ${i * 0.04}s ease both`,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.t1 }}>
                    {c.business_name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {c.dist !== undefined && (
                      <span style={{ fontSize: 12, color: C.purpleL, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Navigation size={11} color={C.purpleL} />
                        {formatDistance(c.dist)}
                      </span>
                    )}
                    {c.requires_pin && (
                      <span style={{ fontSize: 11, color: C.gold, fontWeight: 600,
                        background: C.goldFt, borderRadius: 5, padding: '2px 6px',
                        display: 'flex', alignItems: 'center', gap: 3,
                      }}>
                        <Lock size={9} color={C.gold} />
                        PIN
                      </span>
                    )}
                    {c.task_type && c.task_type !== 'visit' && (
                      <span style={{ fontSize: 11, color: C.t3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <TIcon size={11} color={C.t3} />
                        {TASK_LABEL[c.task_type]}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{
                  background: 'rgba(198,241,53,0.10)',
                  border: '0.5px solid rgba(198,241,53,0.20)',
                  color: '#C6F135', borderRadius: 10, padding: '8px 12px',
                  fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  +{formatGeo(c.reward_amount)} GEO
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <CampaignSheet campaign={selected} userPos={userPos} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
