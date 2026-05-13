import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapPin, Navigation, Lock, ShoppingBag, Star, Loader2, AlertCircle, Crosshair, Gift } from 'lucide-react';
import { API_BASE, apiFetch } from '../lib/api';
import { getGeoPos } from '../lib/geoPos';
import { haversineMeters, formatDistance, formatGeo } from '../lib/geo';
import { C } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';

const MONO = {};
const TASK_ICON = { visit: MapPin, purchase: ShoppingBag, review: Star };
const CAT_LABEL  = { visit: 'FOOD', purchase: 'SHOP', review: 'REVIEW' };
const RARITY = {
  common:    { label: 'COMMON',    color: '#9CA3AF' },
  rare:      { label: 'RARE',      color: '#60A5FA' },
  epic:      { label: 'EPIC',      color: '#C084FC' },
  legendary: { label: 'LEGENDARY', color: '#FBBF24' },
};

function matchPct(c) {
  if (c.dist === undefined) return 82;
  return Math.max(55, Math.min(99, Math.round(99 - c.dist / 80)));
}

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
        borderRadius: '4px 4px 0 0',
        border: `1px solid rgba(255,255,255,0.10)`,
        borderBottom: 'none',
        padding: '0 0 44px', zIndex: 501,
        maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.35s cubic-bezier(0.175,0.885,0.32,1.275)',
        boxShadow: '0 -12px 60px rgba(0,0,0,0.8)',
      }}>
        <div style={{ width: 32, height: 3, borderRadius: 2, background: C.b2, margin: '14px auto 20px' }} />
        <div style={{ padding: '0 20px' }}>
          {/* Sheet header */}
          <div style={{ ...MONO, fontSize: 8, color: C.t3, letterSpacing: 1.5, marginBottom: 6 }}>◆ TARGET DETAIL</div>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 4, color: C.t1, letterSpacing: 0.2 }}>
            {campaign.business_name}
          </div>
          {campaign.address && (
            <div style={{ fontSize: 13, color: C.t3, marginBottom: dist !== null ? 4 : 16, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={11} color={C.t3} />
              {campaign.address}
            </div>
          )}
          {dist !== null && (
            <div style={{ ...MONO, fontSize: 10, color: C.geo, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Navigation size={11} color={C.geo} />
              {formatDistance(dist)} {t('home.from_you')}
            </div>
          )}

          {/* Reward box */}
          <div style={{
            background: C.geoDim,
            border: `1px solid ${C.geoGl}`,
            borderRadius: 14, padding: '16px',
            textAlign: 'center', marginBottom: 10,
          }}>
            <div style={{ ...MONO, fontSize: 9, color: C.t3, marginBottom: 4, letterSpacing: 1.5 }}>REWARD</div>
            <div style={{ ...MONO, fontSize: 40, color: C.t1 }}>
              +{formatGeo(campaign.reward_amount)}
              <span style={{ fontSize: 16, color: C.geo, marginLeft: 6 }}>GEO</span>
            </div>
          </div>

          {/* Task type */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.b1}`,
            borderRadius: 4, padding: '10px 12px', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <TaskIcon size={14} color={C.geo} strokeWidth={2} />
            <div style={{ ...MONO, fontSize: 10, color: C.t2, letterSpacing: 0.5 }}>
              {CAT_LABEL[campaign.task_type] || 'VISIT'}
            </div>
          </div>

          {campaign.requires_pin && (
            <div style={{
              background: 'rgba(255,184,0,0.06)', border: `1px solid rgba(255,184,0,0.18)`,
              borderRadius: 4, padding: '10px 12px', marginBottom: 8,
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <Lock size={13} color={C.gold} strokeWidth={2} />
              <span style={{ ...MONO, fontSize: 9, color: C.gold, letterSpacing: 0.5 }}>{t('map.requires_pin')}</span>
            </div>
          )}

          <button onClick={onClose} style={{
            width: '100%', marginTop: 8,
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.b2}`,
            borderRadius: 4, padding: '14px',
            ...MONO, fontSize: 11, color: C.t2, cursor: 'pointer',
            letterSpacing: 1,
          }}>
            CLOSE
          </button>
        </div>
      </div>
    </>
  );
}

export default function MapPage() {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const markersRef    = useRef([]);
  const userMarkerRef = useRef(null);

  const [campaigns, setCampaigns] = useState([]);
  const [promoQrs,  setPromoQrs]  = useState([]);
  const [userPos,   setUserPos]   = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [mapReady,  setMapReady]  = useState(false);
  const [tileError, setTileError] = useState(false);
  const [stats,     setStats]     = useState(null);

  // Fetch user stats for HUD header
  useEffect(() => {
    Promise.all([
      apiFetch('/api/me').then(r => r.ok ? r.json() : null).catch(() => null),
      apiFetch('/api/game').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([me, game]) => {
      setStats({
        balance: me?.user?.balance ?? 0,
        level:   game?.level ?? 1,
        xp:      game?.xp ?? 0,
        xpNext:  game?.xp_next ?? 2400,
        streak:  game?.streak?.current_streak ?? 0,
      });
    });
  }, []);

  // Campaigns fetch
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

  // Promo QR fetch
  useEffect(() => {
    fetch(`${API_BASE}/api/promos/active`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setPromoQrs(Array.isArray(d) ? d : (d.promos || [])))
      .catch(() => {});
  }, []);

  // Geolocation
  useEffect(() => {
    getGeoPos().then(p => setUserPos(p)).catch(() => {});
  }, []);

  // Leaflet init
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
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

        const osmLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19, subdomains: 'abcd',
        });
        let tileLoaded = false;
        osmLayer.on('tileload', () => { tileLoaded = true; setTileError(false); });
        osmLayer.on('tileerror', () => { if (!tileLoaded) setTileError(true); });
        osmLayer.addTo(map);
        mapRef.current = map;

        [100, 300, 600].forEach(ms => {
          const t = setTimeout(() => { try { map.invalidateSize(); } catch {} }, ms);
          timers.push(t);
        });
        setMapReady(true);
      } catch (e) {
        console.error('[Map] init error:', e);
      }
    }

    const raf = requestAnimationFrame(() => {
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
      html: `<div style="position:relative;width:14px;height:14px;">
        <div style="position:absolute;inset:-10px;border-radius:50%;background:rgba(201,123,71,0.15);animation:radarPing 2s ease-out infinite;"></div>
        <div style="position:absolute;inset:-6px;border-radius:50%;border:1px solid rgba(201,123,71,0.4);animation:radarPing 2s ease-out 0.5s infinite;"></div>
        <div style="width:14px;height:14px;border-radius:50%;background:#C97B47;border:2px solid #06080E;box-shadow:0 0 8px rgba(201,123,71,0.8);"></div>
      </div>`,
      className: '', iconSize: [14, 14], iconAnchor: [7, 7],
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
          position:relative;
          display:flex;align-items:center;justify-content:center;
          animation:markerPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) ${delay}ms both;
        ">
          <div style="position:absolute;width:44px;height:44px;border-radius:50%;border:1px solid rgba(201,123,71,0.4);animation:radarPing 2.5s ease-out ${delay}ms infinite;pointer-events:none;"></div>
          <div style="
            background:rgba(8,16,24,0.92);
            color:#C97B47;padding:5px 10px;border-radius:8px;
            font-size:12px;font-weight:700;white-space:nowrap;
            border:1px solid rgba(201,123,71,0.35);
            box-shadow:0 4px 16px rgba(0,0,0,0.4);
            font-family:'Inter',sans-serif;
            letter-spacing:0.2px;
            position:relative;z-index:1;
          ">+${formatGeo(c.reward_amount)} GEO</div>
        </div>`,
        className: '',
        iconSize: [90, 30],
        iconAnchor: [45, 15],
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

  const xpPct = stats ? Math.min(100, Math.round((stats.xp / stats.xpNext) * 100)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: C.bg }}>

      {/* HUD Stats row */}
      <div style={{
        display: 'flex',
        background: C.surf,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        {/* BALANCE */}
        <div style={{ flex: 1, padding: '10px 12px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ ...MONO, fontSize: 8, color: C.t3, letterSpacing: 1.2, marginBottom: 4 }}>BALANCE</div>
          <div style={{ ...MONO, fontSize: 14, color: C.geo }}>
            {stats ? Math.floor(stats.balance) : '—'}
            <span style={{ fontSize: 8, color: C.t3, marginLeft: 3 }}>GEO</span>
          </div>
        </div>
        {/* LEVEL XP */}
        <div style={{ flex: 1.6, padding: '10px 12px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ ...MONO, fontSize: 8, color: C.t3, letterSpacing: 1.2, marginBottom: 4 }}>
            LEVEL {stats ? String(stats.level).padStart(2, '0') : '--'}
          </div>
          <div style={{ height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1, marginBottom: 3 }}>
            <div style={{ height: '100%', width: `${xpPct}%`, background: C.geo, borderRadius: 1, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ ...MONO, fontSize: 8, color: C.t3 }}>
            {stats ? `${stats.xp}/${stats.xpNext} XP` : '—/— XP'}
          </div>
        </div>
        {/* STREAK */}
        <div style={{ flex: 1, padding: '10px 12px' }}>
          <div style={{ ...MONO, fontSize: 8, color: C.t3, letterSpacing: 1.2, marginBottom: 4 }}>STREAK</div>
          <div style={{ ...MONO, fontSize: 14, color: C.green }}>
            {stats ? `${stats.streak}D` : '—'}
          </div>
        </div>
      </div>

      {/* Map container */}
      <div style={{ position: 'relative', flexShrink: 0, height: '46vh', minHeight: 220 }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Radar grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 900, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* LAT — top left */}
        {userPos && (
          <div style={{
            position: 'absolute', top: 8, left: 8, zIndex: 1000, pointerEvents: 'none',
            ...MONO, fontSize: 9, color: C.geo,
            background: 'rgba(6,8,14,0.80)', padding: '3px 7px',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
          }}>
            LAT {userPos.lat.toFixed(3)}°N
          </div>
        )}

        {/* LON — top right (above zoom controls) */}
        {userPos && (
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 1000, pointerEvents: 'none',
            ...MONO, fontSize: 9, color: C.geo,
            background: 'rgba(6,8,14,0.80)', padding: '3px 7px',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
          }}>
            LON {userPos.lng.toFixed(3)}°E
          </div>
        )}

        {/* GPS-LOCK — bottom left */}
        <div style={{
          position: 'absolute', bottom: 8, left: 8, zIndex: 1000, pointerEvents: 'none',
          ...MONO, fontSize: 9, color: userPos ? C.green : C.t3,
          background: 'rgba(6,8,14,0.80)', padding: '3px 8px',
          border: `1px solid ${userPos ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 2,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            background: userPos ? C.green : C.t3,
            display: 'inline-block',
            boxShadow: userPos ? '0 0 4px rgba(0,255,136,0.7)' : 'none',
          }} />
          {userPos ? 'GPS-LOCK 99%' : 'GPS SEARCH…'}
        </div>

        {/* Compass + range — bottom right */}
        <div style={{
          position: 'absolute', bottom: 8, right: 8, zIndex: 1000, pointerEvents: 'none',
          background: 'rgba(6,8,14,0.80)', padding: '4px 8px',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        }}>
          <div style={{ ...MONO, fontSize: 12, color: C.t1, lineHeight: 1 }}>N</div>
          <div style={{ ...MONO, fontSize: 7, color: C.t3 }}>R: 2.0KM</div>
        </div>

        {/* Zoom + locate controls (shifted below LON label) */}
        <div style={{ position: 'absolute', top: 34, right: 8, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {['+', '−'].map((sym, i) => (
            <button key={sym} onClick={() => {
              const map = mapRef.current;
              if (map) i === 0 ? map.zoomIn() : map.zoomOut();
            }} style={{
              width: 28, height: 28, borderRadius: 2,
              border: `1px solid ${C.b2}`,
              background: 'rgba(6,8,14,0.88)',
              ...MONO, fontSize: 15, cursor: 'pointer', color: C.t1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{sym}</button>
          ))}
          {userPos && (
            <button onClick={() => mapRef.current?.setView([userPos.lat, userPos.lng], 15)} style={{
              width: 28, height: 28, borderRadius: 2,
              border: `1px solid ${C.geoGl}`,
              background: 'rgba(6,8,14,0.88)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Crosshair size={13} color={C.geo} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Tile error */}
        {tileError && (
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, background: 'rgba(255,56,96,0.10)',
            border: '1px solid rgba(255,56,96,0.25)',
            borderRadius: 2, padding: '4px 10px',
            ...MONO, fontSize: 9, color: C.red,
            display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
          }}>
            <AlertCircle size={11} color={C.red} />
            TILES OFFLINE
          </div>
        )}
      </div>

      {/* Nearby targets list */}
      <div style={{ flex: 1, overflowY: 'auto', background: C.bg, paddingBottom: 68 }}>
        {/* Section header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.geo }}>Ближайшие</span>
          </div>
          <div style={{ fontSize: 11, color: C.t3, display: 'flex', alignItems: 'center', gap: 6 }}>
            {!loading && <span>{nearby.length} мест</span>}
            <span style={{ color: userPos ? C.green : C.gold }}>
              {userPos ? '· GPS ✓' : '· GPS …'}
            </span>
          </div>
        </div>

        <div style={{ padding: '0 16px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
              <Loader2 size={22} color={C.geo} style={{ animation: 'spin 1s linear infinite' }} />
              <div style={{ ...MONO, fontSize: 9, color: C.t3, letterSpacing: 1.2 }}>SCANNING TARGETS…</div>
            </div>
          )}

          {!loading && nearby.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <div style={{ ...MONO, fontSize: 10, color: C.t3, letterSpacing: 1.2, marginBottom: 6 }}>NO TARGETS DETECTED</div>
              <div style={{ ...MONO, fontSize: 9, color: C.t3, opacity: 0.45 }}>EXPAND RANGE OR CHECK LATER</div>
            </div>
          )}

          {!loading && nearby.map((c, i) => {
            const TIcon = TASK_ICON[c.task_type] || MapPin;
            const cat   = CAT_LABEL[c.task_type] || 'FOOD';
            const pct   = matchPct(c);
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
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{ ...MONO, fontSize: 10, color: C.t3, width: 18, flexShrink: 0, textAlign: 'right' }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: 2, flexShrink: 0,
                  background: C.geoDim, border: `1px solid ${C.geoGl}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <TIcon size={11} color={C.t3} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 14,
                    color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: 2,
                  }}>
                    {c.business_name}
                  </div>
                  <div style={{ ...MONO, fontSize: 9, color: C.t3 }}>
                    {c.dist !== undefined ? formatDistance(c.dist) : '—'} · {cat}
                    {c.requires_pin && <span style={{ color: C.gold }}> · PIN</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ ...MONO, fontSize: 13, color: C.geo }}>+{formatGeo(c.reward_amount)}</div>
                  <div style={{ ...MONO, fontSize: 8, color: C.green }}>MATCH {pct}%</div>
                </div>
              </div>
            );
          })}

          {/* Promo QR section */}
          {!loading && promoQrs.length > 0 && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '12px 0 8px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                marginTop: nearby.length > 0 ? 4 : 0,
              }}>
                <div style={{ width: 2, height: 10, background: C.geo, borderRadius: 1, flexShrink: 0 }} />
                <Gift size={10} color={C.geo} strokeWidth={2} />
                <span style={{ ...MONO, fontSize: 9, color: C.geo, letterSpacing: 2 }}>PROMO QR</span>
                <span style={{
                  ...MONO, fontSize: 8, color: C.geo,
                  background: C.geoDim, border: `1px solid ${C.geoGl}`,
                  borderRadius: 6, padding: '1px 6px', marginLeft: 'auto',
                }}>{String(promoQrs.length).padStart(2, '0')}</span>
              </div>

              {promoQrs.map((p, i) => {
                const rr = RARITY[p.rarity] || RARITY.common;
                const remaining = p.max_claims - p.claims_count;
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                    <div style={{ ...MONO, fontSize: 10, color: C.t3, width: 18, flexShrink: 0, textAlign: 'right' }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: 2, flexShrink: 0,
                      background: `${rr.color}12`, border: `1px solid ${rr.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Gift size={11} color={rr.color} strokeWidth={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 14,
                        color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: 2,
                      }}>
                        {p.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ ...MONO, fontSize: 8, color: rr.color, background: `${rr.color}12`, borderRadius: 2, padding: '1px 4px', border: `1px solid ${rr.color}30` }}>
                          {rr.label}
                        </span>
                        {remaining > 0 && (
                          <span style={{ ...MONO, fontSize: 8, color: C.t3 }}>{remaining} left</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ ...MONO, fontSize: 13, color: rr.color }}>+{formatGeo(p.reward_amount)}</div>
                      <div style={{ ...MONO, fontSize: 8, color: C.t3 }}>GEO</div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {selected && (
        <CampaignSheet campaign={selected} userPos={userPos} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
