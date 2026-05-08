import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { haversineMeters, formatDistance, formatGeo } from '../lib/geo';

const ANIM = `
  @keyframes fadeUp { from{transform:translateY(10px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes userPing {
    0%   { transform:scale(1);  opacity:0.8; }
    100% { transform:scale(2.8);opacity:0; }
  }
  @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
  @keyframes backdrop{ from{opacity:0} to{opacity:1} }
`;

const TASK_LABEL = { visit: '📍 Визит', purchase: '🛍 Покупка', review: '⭐ Отзыв' };

function CampaignSheet({ campaign, userPos, onClose }) {
  const dist = userPos && campaign.lat && campaign.lng
    ? haversineMeters(userPos, { lat: +campaign.lat, lng: +campaign.lng })
    : null;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 500, animation: 'backdrop 0.2s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '0 0 40px', zIndex: 501,
        maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.3s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E0E0E0', margin: '12px auto 20px' }} />
        <div style={{ padding: '0 24px' }}>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 4, color: '#1C1C1E' }}>
            {campaign.business_name}
          </div>
          {campaign.address && (
            <div style={{ fontSize: 14, color: '#8E8E93', marginBottom: dist !== null ? 4 : 20 }}>
              📍 {campaign.address}
            </div>
          )}
          {dist !== null && (
            <div style={{ fontSize: 13, color: '#2AABEE', fontWeight: 700, marginBottom: 20 }}>
              🧭 {formatDistance(dist)} от вас
            </div>
          )}

          <div style={{
            background: 'linear-gradient(135deg, #34C759, #25a244)',
            borderRadius: 16, padding: '20px',
            color: '#fff', textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>Вознаграждение</div>
            <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: -1 }}>
              +{formatGeo(campaign.reward_amount)}
              <span style={{ fontSize: 18, fontWeight: 600, opacity: 0.9, marginLeft: 6 }}>GEO</span>
            </div>
          </div>

          <div style={{ background: '#F2F2F7', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#8E8E93', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
              Тип задания
            </div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {TASK_LABEL[campaign.task_type] || '📍 Визит'}
            </div>
          </div>

          {campaign.requires_pin && (
            <div style={{
              background: 'rgba(255,149,0,0.1)', border: '1.5px solid rgba(255,149,0,0.25)',
              borderRadius: 12, padding: '12px 14px', marginBottom: 12,
              display: 'flex', gap: 10, alignItems: 'center',
            }}>
              <span style={{ fontSize: 18 }}>🔐</span>
              <span style={{ fontSize: 13, color: '#CC7A00', fontWeight: 600 }}>
                Требуется PIN от сотрудника
              </span>
            </div>
          )}

          <button onClick={onClose} style={{
            width: '100%', marginTop: 8,
            background: '#F2F2F7', border: 'none', borderRadius: 14,
            padding: '15px', fontSize: 16, fontWeight: 700,
            color: '#3C3C3E', cursor: 'pointer',
          }}>
            Закрыть
          </button>
        </div>
      </div>
    </>
  );
}

export default function MapPage() {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef([]);
  const userMarkerRef = useRef(null);

  const [campaigns, setCampaigns] = useState([]);
  const [userPos,   setUserPos]   = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [loading,   setLoading]   = useState(true);

  // Load campaigns
  useEffect(() => {
    fetch(`${API_BASE}/api/campaigns`, { headers: { initdata: initData } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Get user location (non-blocking)
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, []);

  // Init Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = [41.2995, 69.2401]; // Tashkent default
    const map = L.map(containerRef.current, {
      center,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // User position marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;

    if (userMarkerRef.current) userMarkerRef.current.remove();

    const icon = L.divIcon({
      html: `<div style="position:relative;width:18px;height:18px;">
        <div style="position:absolute;inset:-10px;border-radius:50%;background:rgba(42,171,238,0.2);animation:userPing 2s ease-out infinite;"></div>
        <div style="position:absolute;inset:-5px;border-radius:50%;background:rgba(42,171,238,0.15);animation:userPing 2s ease-out 0.6s infinite;"></div>
        <div style="width:18px;height:18px;border-radius:50%;background:#2AABEE;border:3px solid #fff;box-shadow:0 2px 10px rgba(42,171,238,0.55);"></div>
      </div>`,
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon, zIndexOffset: 1000 }).addTo(map);
    map.setView([userPos.lat, userPos.lng], 14);
  }, [userPos]);

  // Campaign markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || campaigns.length === 0) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    campaigns.forEach(c => {
      if (!c.lat || !c.lng) return;

      const icon = L.divIcon({
        html: `<div style="
          background:linear-gradient(135deg,#34C759,#25a244);
          color:#fff;padding:5px 10px;border-radius:20px;
          font-size:12px;font-weight:800;white-space:nowrap;
          box-shadow:0 3px 12px rgba(52,199,89,0.5);border:2px solid #fff;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        ">+${formatGeo(c.reward_amount)} GEO</div>`,
        className: '',
        iconAnchor: [32, 14],
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <style>{ANIM}</style>

      {/* Map */}
      <div style={{ position: 'relative', flex: '0 0 52vh' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'linear-gradient(135deg, #E8F5FF, #F0FAF0)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 48 }}>🗺️</div>
            <div style={{ color: '#8E8E93', fontSize: 14, fontWeight: 600 }}>Загружаем карту…</div>
            <div style={{ width: 48, height: 4, borderRadius: 2, background: '#E0E0E0', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#2AABEE', animation: 'pulse 1.2s infinite', width: '60%' }} />
            </div>
          </div>
        )}

        {/* Zoom controls */}
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['+', '−'].map((sym, i) => (
            <button key={sym} onClick={() => {
              const map = mapRef.current;
              if (map) i === 0 ? map.zoomIn() : map.zoomOut();
            }} style={{
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#1C1C1E',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{sym}</button>
          ))}
          {userPos && (
            <button onClick={() => mapRef.current?.setView([userPos.lat, userPos.lng], 15)} style={{
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>📍</button>
          )}
        </div>

        {/* Campaign count badge */}
        {!loading && nearby.length > 0 && (
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 10,
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
            borderRadius: 20, padding: '6px 14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
            fontSize: 13, fontWeight: 700, color: '#1C1C1E',
          }}>
            🏪 {nearby.length} {nearby.length === 1 ? 'кампания' : nearby.length < 5 ? 'кампании' : 'кампаний'}
          </div>
        )}
      </div>

      {/* Nearby list */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#EFEFF4', paddingBottom: 88 }}>
        <div style={{ padding: '14px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {userPos ? 'Рядом с вами' : 'Все заведения'}
          </div>
          {!userPos && !loading && (
            <div style={{ fontSize: 12, color: '#FF9500', fontWeight: 600 }}>📍 Геолокация недоступна</div>
          )}
        </div>

        <div style={{ padding: '0 16px' }}>
          {loading && [1, 2, 3].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', animation: 'pulse 1.4s infinite' }}>
              <div>
                <div style={{ background: '#F2F2F7', borderRadius: 6, height: 14, width: 130, marginBottom: 8 }} />
                <div style={{ background: '#F2F2F7', borderRadius: 6, height: 11, width: 70 }} />
              </div>
              <div style={{ background: '#F2F2F7', borderRadius: 10, height: 36, width: 100, alignSelf: 'center' }} />
            </div>
          ))}

          {!loading && nearby.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>📍</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Нет кампаний на карте</div>
              <div style={{ color: '#8E8E93', fontSize: 14, lineHeight: 1.6 }}>
                Бизнесы ещё не привязали<br />координаты к заведениям
              </div>
            </div>
          )}

          {!loading && nearby.map((c, i) => (
            <div
              key={c.id}
              onClick={() => {
                setSelected(c);
                if (mapRef.current && c.lat && c.lng) {
                  mapRef.current.setView([+c.lat, +c.lng], 16);
                }
              }}
              style={{
                background: '#fff', borderRadius: 14,
                padding: '14px 16px', marginBottom: 8,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                animation: `fadeUp 0.3s ${i * 0.04}s ease both`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.business_name}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {c.dist !== undefined && (
                    <span style={{ fontSize: 12, color: '#2AABEE', fontWeight: 600 }}>
                      🧭 {formatDistance(c.dist)}
                    </span>
                  )}
                  {c.requires_pin && (
                    <span style={{ fontSize: 11, color: '#FF9500', fontWeight: 600 }}>🔐 PIN</span>
                  )}
                  {c.task_type && c.task_type !== 'visit' && (
                    <span style={{ fontSize: 11, color: '#8E8E93', fontWeight: 600 }}>
                      {TASK_LABEL[c.task_type]}
                    </span>
                  )}
                </div>
              </div>
              <div style={{
                background: 'linear-gradient(135deg, #34C759, #25a244)',
                color: '#fff', borderRadius: 10, padding: '8px 12px',
                fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(52,199,89,0.3)', flexShrink: 0,
              }}>
                +{formatGeo(c.reward_amount)} GEO
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <CampaignSheet campaign={selected} userPos={userPos} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
