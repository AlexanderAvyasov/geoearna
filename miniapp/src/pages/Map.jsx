import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Navigation, Lock, Store, Map as MapIcon, Crosshair, ShoppingBag, Star, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { API_BASE } from '../lib/api';
import { getGeoPos } from '../lib/geoPos';
import { haversineMeters, formatDistance, formatGeo } from '../lib/geo';
import { C, cardBase } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';
import { pluralize } from '../lib/i18n';

const TASK_ICON = { visit: MapPin, purchase: ShoppingBag, review: Star };

function CampaignSheet({ campaign, userPos, onClose }) {
  const { t } = useLanguage();
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
        animation: 'slideUp 0.35s cubic-bezier(0.175,0.885,0.32,1.275)',
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
            <div style={{ fontSize: 13, color: C.geo, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Navigation size={13} color={C.geo} />
              {formatDistance(dist)} {t('home.from_you')}
            </div>
          )}

          <div style={{
            background: 'linear-gradient(135deg, rgba(198,241,53,0.10) 0%, rgba(198,241,53,0.05) 100%)',
            border: '1.5px solid rgba(198,241,53,0.20)',
            borderRadius: 18, padding: '20px',
            textAlign: 'center', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('home.reward')}</div>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -1, color: C.t1 }}>
              +{formatGeo(campaign.reward_amount)}
              <span style={{ fontSize: 18, fontWeight: 600, color: C.geo, marginLeft: 6 }}>GEO</span>
            </div>
          </div>

          <div style={{ ...cardBase, border: `1px solid ${C.b0}`, borderRadius: 14, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{t('home.task_type')}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: C.t1, display: 'flex', alignItems: 'center', gap: 7 }}>
              <TaskIcon size={16} color={C.geo} strokeWidth={2} />
              {t('task.' + (campaign.task_type || 'visit'))}
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
                {t('map.requires_pin')}
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
            {t('home.close')}
          </button>
        </div>
      </div>
    </>
  );
}

export default function MapPage() {
  const { t, lang } = useLanguage();
  const navigate      = useNavigate();
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const markersRef    = useRef([]);
  const userMarkerRef = useRef(null);

  const [campaigns,  setCampaigns]  = useState([]);
  const [userPos,    setUserPos]    = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [mapReady,   setMapReady]   = useState(false);
  const [tileError,  setTileError]  = useState(false);

  // Campaigns fetch — public endpoint, no initData wait needed
  useEffect(() => {
    const ctrl = new AbortController();
    const bail = setTimeout(() => { ctrl.abort(); setLoading(false); }, 6000);

    fetch(`${API_BASE}/api/campaigns`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => { clearTimeout(bail); setLoading(false); });

    return () => { ctrl.abort(); clearTimeout(bail); };
  }, []);

  // Geolocation (non-blocking)
  useEffect(() => {
    getGeoPos().then(p => setUserPos(p)).catch(() => {});
  }, []);

  // Leaflet init — waits for container to have actual pixel size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Clear any stale Leaflet binding from prior mount
    if (el._leaflet_id) { delete el._leaflet_id; }

    let map;
    let timers = [];

    function init() {
      if (mapRef.current) return;
      try {
        map = L.map(el, {
          center: [41.2995, 69.2401], zoom: 12,
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
        });

        // OpenStreetMap tiles — reliable globally, no API key needed
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: 'abc',
        });

        // Detect if tiles actually load; fall back gracefully
        let tileLoaded = false;
        osmLayer.on('tileload', () => { tileLoaded = true; setTileError(false); });
        osmLayer.on('tileerror', () => { if (!tileLoaded) setTileError(true); });
        osmLayer.addTo(map);

        mapRef.current = map;

        // Multiple invalidateSize calls to handle async container expansion
        [100, 300, 600].forEach(ms => {
          const t = setTimeout(() => {
            try { map.invalidateSize(); } catch {}
          }, ms);
          timers.push(t);
        });

        setMapReady(true);
      } catch (e) {
        console.error('[Map] init error:', e);
      }
    }

    // Use rAF to ensure the DOM element has rendered with its CSS dimensions
    const raf = requestAnimationFrame(() => {
      // Small delay so flex layout has settled
      const t = setTimeout(init, 50);
      timers.push(t);
    });

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      if (map) { try { map.remove(); } catch {} }
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // User position marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;
    if (userMarkerRef.current) { userMarkerRef.current.remove(); }

    const icon = L.divIcon({
      html: `<div style="position:relative;width:16px;height:16px;">
        <div style="position:absolute;inset:-12px;border-radius:50%;background:rgba(198,241,53,0.18);animation:userPing 2s ease-out infinite;"></div>
        <div style="width:16px;height:16px;border-radius:50%;background:#C6F135;border:2.5px solid #090B10;"></div>
      </div>`,
      className: '', iconSize: [16, 16], iconAnchor: [8, 8],
    });

    userMarkerRef.current = L.marker([userPos.lat, userPos.lng], { icon, zIndexOffset: 1000 }).addTo(map);
    map.setView([userPos.lat, userPos.lng], 14);
  }, [userPos, mapReady]);

  // Campaign markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    campaigns.forEach((c, idx) => {
      if (!c.lat || !c.lng) return;
      const delay = idx * 60;
      const icon = L.divIcon({
        html: `<div style="
          display:inline-block;
          transform:translate(-50%,-100%) scale(1);
          background:#C6F135;
          color:#090B10;padding:5px 11px;border-radius:20px;
          font-size:13px;font-weight:800;white-space:nowrap;
          border:1.5px solid rgba(198,241,53,0.3);
          pointer-events:none;
          animation:markerPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) ${delay}ms both;
        ">+${formatGeo(c.reward_amount)} GEO</div>`,
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([+c.lat, +c.lng], { icon }).addTo(map);
      marker.on('click', () => setSelected(c));
      markersRef.current.push(marker);
    });
  }, [campaigns, mapReady]);

  const nearby = (() => {
    const withCoords = campaigns.filter(c => c.lat && c.lng);
    if (!userPos) return withCoords;
    return withCoords
      .map(c => ({ ...c, dist: haversineMeters(userPos, { lat: +c.lat, lng: +c.lng }) }))
      .sort((a, b) => a.dist - b.dist);
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: C.bg }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        background: C.surf,
        borderBottom: `1px solid ${C.b1}`,
        flexShrink: 0,
        zIndex: 20,
      }}>
        <button onClick={() => navigate('/')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.geo, padding: '4px 8px 4px 0',
          display: 'flex', alignItems: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <ArrowLeft size={22} color={C.geo} strokeWidth={2} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <MapIcon size={18} color={C.geo} strokeWidth={1.75} />
          <span style={{ fontWeight: 700, fontSize: 18, color: C.t1 }}>{t('map.title')}</span>
        </div>
        {!loading && (
          <div style={{
            fontSize: 12, color: C.t2, fontWeight: 600,
            background: C.b0,
            borderRadius: 10, padding: '3px 10px',
          }}>
            {pluralize(lang, nearby.length, t('map.place.one'), t('map.place.few'), t('map.place.many'))}
          </div>
        )}
      </div>

      {/* Map container */}
      <div style={{ position: 'relative', flexShrink: 0, height: '46vh', minHeight: 220 }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Tile error banner */}
        {tileError && (
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            zIndex: 15, background: 'rgba(248,113,113,0.15)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 10, padding: '5px 12px',
            fontSize: 12, color: C.red, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5,
            whiteSpace: 'nowrap',
          }}>
            <AlertCircle size={13} color={C.red} />
            Карты недоступны
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
              border: `1px solid ${C.b2}`,
              background: C.card, backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
              fontSize: 18, fontWeight: 700, cursor: 'pointer', color: C.t1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{sym}</button>
          ))}
          {userPos && (
            <button onClick={() => mapRef.current?.setView([userPos.lat, userPos.lng], 15)} style={{
              width: 36, height: 36, borderRadius: 10,
              border: `1px solid rgba(198,241,53,0.25)`,
              background: C.card, backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Crosshair size={18} color={C.geo} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Campaign count badge */}
        {!loading && nearby.length > 0 && (
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 10,
            background: C.card, backdropFilter: 'blur(8px)',
            border: `1px solid ${C.b1}`,
            borderRadius: 20, padding: '6px 12px',
            fontSize: 13, fontWeight: 700, color: C.t1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Store size={13} color={C.t3} strokeWidth={2} />
            {pluralize(lang, nearby.length, t('map.camp.one'), t('map.camp.few'), t('map.camp.many'))}
          </div>
        )}
      </div>

      {/* Campaign list */}
      <div style={{ flex: 1, overflowY: 'auto', background: C.bg, paddingBottom: 88 }}>
        <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1 }}>
            {userPos ? t('map.nearby') : t('map.all_venues')}
          </div>
          {!userPos && !loading && (
            <div style={{ fontSize: 12, color: C.orange, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={12} color={C.orange} />
              {t('map.geo_unavailable')}
            </div>
          )}
        </div>

        <div style={{ padding: '0 16px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 14 }}>
              <Loader2 size={32} color={C.geo} style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: 13, color: C.t2, fontWeight: 600 }}>Загрузка акций…</div>
            </div>
          )}

          {!loading && nearby.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <MapPin size={52} color={C.t3} strokeWidth={1.25} style={{ opacity: 0.4, marginBottom: 14 }} />
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: C.t1 }}>{t('map.empty.title')}</div>
              <div style={{ color: C.t3, fontSize: 14, lineHeight: 1.6 }}>
                {t('map.empty.text').split('\n').map((l, i) => <span key={i}>{l}{i === 0 && <br />}</span>)}
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
                  border: `1px solid ${C.b1}`,
                  padding: '14px 16px', marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  cursor: 'pointer',
                  animation: `fadeUp 0.36s ${i * 0.06}s cubic-bezier(0.32,0.72,0,1) both`,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.t1 }}>
                    {c.business_name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {c.dist !== undefined && (
                      <span style={{ fontSize: 12, color: C.geo, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Navigation size={11} color={C.geo} />
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
                        {t('task.' + c.task_type)}
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
