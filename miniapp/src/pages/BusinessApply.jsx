import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Store, CheckCircle, Clock, XCircle, Loader2,
  AlertTriangle, MapPin, Crosshair, X,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { apiFetch } from '../lib/api';
import { C, FF, inputStyle, cardBase } from '../lib/design';
import RippleButton from '../lib/RippleButton';
import { useLanguage } from '../contexts/LanguageContext';

const CAT_KEYS = [
  'apply.cat.cafe',
  'apply.cat.shop',
  'apply.cat.pharmacy',
  'apply.cat.beauty',
  'apply.cat.gym',
  'apply.cat.auto',
  'apply.cat.other',
];

const DEFAULT_CENTER = [41.2995, 69.2401]; // Ташкент

// ── Reverse geocode via Nominatim ─────────────────────────────────────────────
async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru`,
      { headers: { 'User-Agent': 'GeoEarn-App/1.0' } }
    );
    if (!r.ok) return null;
    const d = await r.json();
    const a = d.address || {};
    const parts = [
      a.road || a.pedestrian || a.footway,
      a.house_number,
      a.suburb || a.neighbourhood,
      a.city || a.town || a.village,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : (d.display_name?.split(',').slice(0, 3).join(',') || null);
  } catch {
    return null;
  }
}

// ── Polished map pin HTML (reused for all marker placements) ─────────────────
function makePinHtml() {
  return `
    <div style="position:relative;width:44px;height:52px;pointer-events:none;">
      <div style="
        position:absolute;top:4px;left:2px;
        width:40px;height:40px;border-radius:50%;
        background:${C.geo}28;
        animation:markerPulse 2.2s cubic-bezier(0.23,1,0.32,1) infinite;
      "></div>
      <div style="
        position:absolute;top:0;left:6px;
        width:32px;height:32px;
        border-radius:50% 50% 50% 0;
        background:${C.geo};
        border:3px solid rgba(255,255,255,0.95);
        transform:rotate(-45deg);
        box-shadow:0 4px 18px ${C.geo}70, 0 2px 6px rgba(0,0,0,0.55);
      "></div>
    </div>
  `;
}

// ── Map picker sheet ──────────────────────────────────────────────────────────
export function MapPickerSheet({ initialPos, onConfirm, onClose, zBase = 300 }) {
  const { t } = useLanguage();
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markerRef    = useRef(null);
  const [pos,       setPos]       = useState(initialPos || null);
  const [geocoding, setGeocoding] = useState(false);
  const [locating,  setLocating]  = useState(false);
  const [address,   setAddress]   = useState('');

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: initialPos ? [initialPos.lat, initialPos.lng] : DEFAULT_CENTER,
      zoom: initialPos ? 16 : 13,
      zoomControl: false,
      attributionControl: false,
    });

    // OSM standard tiles + CSS invert = dark map with full building detail
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    setTimeout(() => {
      el.querySelectorAll('.leaflet-tile-pane').forEach(p => {
        p.style.filter = 'invert(0.92) hue-rotate(180deg) brightness(0.88) contrast(1.05) saturate(0.75)';
      });
    }, 80);

    const icon = L.divIcon({
      html: makePinHtml(),
      iconSize: [44, 52], iconAnchor: [22, 52], className: '',
    });

    function addMarker(lat, lng) {
      const m = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      markerRef.current = m;
      m.on('dragend', () => {
        const ll = m.getLatLng();
        updatePos(ll.lat, ll.lng);
      });
      return m;
    }

    if (initialPos) addMarker(initialPos.lat, initialPos.lng);

    map.on('click', e => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        addMarker(lat, lng);
      }
      updatePos(lat, lng);
    });

    mapRef.current = map;
    setTimeout(() => { try { map.invalidateSize(); } catch {} }, 150);

    return () => {
      try { map.remove(); } catch {}
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  async function updatePos(lat, lng) {
    setPos({ lat, lng });
    setGeocoding(true);
    setAddress('');
    const result = await reverseGeocode(lat, lng);
    setAddress(result || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setGeocoding(false);
  }

  function goToMyLocation() {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lng } = coords;
        const map = mapRef.current;
        if (!map) return;
        map.setView([lat, lng], 17);
        const icon = L.divIcon({
          html: makePinHtml(),
          iconSize: [44, 52], iconAnchor: [22, 52], className: '',
        });
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const m = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
          markerRef.current = m;
          m.on('dragend', () => {
            const ll = m.getLatLng();
            updatePos(ll.lat, ll.lng);
          });
        }
        updatePos(lat, lng);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  function handleConfirm() {
    if (!pos) return;
    onConfirm({ lat: pos.lat, lng: pos.lng, address });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          zIndex: zBase, animation: 'backdropIn 0.2s ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#0D1520',
        borderRadius: '22px 22px 0 0',
        border: `1px solid rgba(201,123,71,0.18)`, borderBottom: 'none',
        zIndex: zBase + 1, maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '92vh',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6), 0 -1px 0 rgba(201,123,71,0.12) inset',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: `rgba(201,123,71,0.3)`,
          margin: '12px auto 0', flexShrink: 0,
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px 10px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: C.geoDim, border: `1px solid ${C.geoGl}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MapPin size={14} color={C.geo} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{t('apply.map.title')}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              transition: 'background 0.15s ease-out',
            }}
            onTouchStart={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            onTouchEnd={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseDown={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            onMouseUp={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          >
            <X size={13} color={C.t2} />
          </button>
        </div>

        <div style={{ fontSize: 12, color: C.t3, padding: '0 18px 10px', flexShrink: 0 }}>
          {t('apply.map.hint')}
        </div>

        {/* Map with fade edges */}
        <div style={{
          position: 'relative', flexShrink: 0,
          borderTop: `1px solid rgba(201,123,71,0.18)`,
          borderBottom: `1px solid rgba(201,123,71,0.18)`,
        }}>
          <div ref={containerRef} style={{ height: '48vmax', maxHeight: 320, minHeight: 200 }} />

          {/* Top gradient fade — blends map into sheet */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 28,
            background: 'linear-gradient(to bottom, #0D1520 0%, transparent 100%)',
            pointerEvents: 'none', zIndex: 998,
          }} />

          {/* My location button */}
          <button
            onClick={goToMyLocation}
            style={{
              position: 'absolute', bottom: 12, right: 12, zIndex: 999,
              width: 42, height: 42, borderRadius: '50%',
              background: 'rgba(8,16,24,0.94)',
              border: `1px solid rgba(201,123,71,0.35)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              boxShadow: `0 2px 12px rgba(0,0,0,0.55), 0 0 0 1px rgba(201,123,71,0.10)`,
              transition: 'transform 120ms cubic-bezier(0.23,1,0.32,1)',
            }}
            onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
            onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.92)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {locating
              ? <Loader2 size={18} color={C.geo} style={{ animation: 'spin 1s linear infinite' }} />
              : <Crosshair size={18} color={C.geo} strokeWidth={1.75} />
            }
          </button>
        </div>

        {/* Address preview */}
        <div style={{
          margin: '12px 16px 0',
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${pos ? `rgba(201,123,71,0.20)` : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 12,
          flexShrink: 0,
          minHeight: 48,
          display: 'flex', alignItems: 'center', gap: 10,
          transition: 'border-color 0.25s ease-out',
          animation: 'fadeUp 0.25s cubic-bezier(0.23,1,0.32,1) both',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: pos ? C.geoDim : 'rgba(255,255,255,0.04)',
            border: `1px solid ${pos ? C.geoGl : 'rgba(255,255,255,0.06)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.25s ease-out',
          }}>
            <MapPin size={13} color={pos ? C.geo : C.t3} strokeWidth={2} />
          </div>
          {pos ? (
            geocoding
              ? <div className="sk" style={{ height: 14, width: 180, borderRadius: 6 }} />
              : <span style={{
                  fontSize: 13, color: C.t1, lineHeight: 1.45, fontWeight: 500,
                  animation: 'staggerIn 0.2s cubic-bezier(0.23,1,0.32,1) both',
                }}>
                  {address || `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`}
                </span>
          ) : (
            <span style={{ fontSize: 13, color: C.t3 }}>{t('apply.map.no_pos')}</span>
          )}
        </div>
        <div style={{ flexShrink: 0, height: 4 }} />

        {/* Confirm */}
        <div style={{ padding: '0 16px 32px', flexShrink: 0 }}>
          <button
            onClick={handleConfirm}
            disabled={!pos || geocoding}
            style={{
              width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
              background: (!pos || geocoding) ? 'rgba(201,123,71,0.25)' : C.geo,
              color: (!pos || geocoding) ? C.t3 : C.bg,
              fontSize: 15, fontWeight: 700, cursor: (!pos || geocoding) ? 'not-allowed' : 'pointer',
              fontFamily: FF.body,
              boxShadow: (!pos || geocoding) ? 'none' : '0 4px 20px rgba(201,123,71,0.30)',
              transition: 'all 0.2s',
            }}
          >
            {geocoding ? t('apply.map.geocoding') : t('apply.map.confirm')}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Form components ───────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, inputMode, required, hint, readOnly }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        {label}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
      </div>
      <input
        value={value}
        onChange={e => !readOnly && onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode || 'text'}
        readOnly={readOnly}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ ...inputStyle(focused, false), ...(readOnly ? { color: C.t2, cursor: 'default' } : {}) }}
      />
      {hint && <div style={{ fontSize: 12, color: C.t3, marginTop: 6, paddingLeft: 2 }}>{hint}</div>}
    </div>
  );
}

function SelectField({ label, value, onChange }) {
  const { t } = useLanguage();
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        {label}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputStyle(focused, false),
          appearance: 'none', WebkitAppearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234A5560' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
          paddingRight: 36, cursor: 'pointer',
        }}
      >
        <option value="">{t('apply.form.no_cat')}</option>
        {CAT_KEYS.map(key => <option key={key} value={t(key)}>{t(key)}</option>)}
      </select>
    </div>
  );
}

function StatusBanner({ application }) {
  const { t, lang } = useLanguage();
  const cfg = {
    pending:  { icon: Clock,       color: C.gold,  bg: C.goldFt,  titleKey: 'apply.status.pending.title',  subKey: 'apply.status.pending.sub'  },
    approved: { icon: CheckCircle, color: C.green, bg: C.greenFt, titleKey: 'apply.status.approved.title', subKey: 'apply.status.approved.sub' },
    rejected: { icon: XCircle,     color: C.red,   bg: C.redFt,   titleKey: 'apply.status.rejected.title', subKey: 'apply.status.rejected.sub' },
  };
  const { icon: Icon, color, bg, titleKey, subKey } = cfg[application.status] || cfg.pending;
  const sub = application.status === 'rejected' && application.review_note
    ? application.review_note
    : t(subKey);
  return (
    <div style={{
      ...cardBase, padding: '20px 18px', marginBottom: 24,
      background: bg, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <Icon size={24} color={color} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 4 }}>{t(titleKey)}</div>
        <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.55 }}>{sub}</div>
        <div style={{ fontSize: 11, color: C.t3, marginTop: 8 }}>
          {t('apply.status.info', { id: application.id, date: new Date(application.created_at).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : lang === 'en' ? 'en-GB' : 'ru-RU') })}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BusinessApply() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [existing,    setExisting]    = useState(undefined);
  const [loadingInit, setLoadingInit] = useState(true);

  const [name,     setName]     = useState('');
  const [address,  setAddress]  = useState('');
  const [lat,      setLat]      = useState(null);
  const [lng,      setLng]      = useState(null);
  const [category, setCategory] = useState('');
  const [phone,    setPhone]    = useState('');

  const [mapOpen,    setMapOpen]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);

  useEffect(() => {
    apiFetch('/api/user/apply-business')
      .then(r => r.ok ? r.json() : null)
      .then(data => setExisting(data?.application || null))
      .catch(() => setExisting(null))
      .finally(() => setLoadingInit(false));
  }, []);

  function handleMapConfirm({ lat: la, lng: ln, address: addr }) {
    setLat(la);
    setLng(ln);
    if (addr) setAddress(addr);
    setMapOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError(t('apply.err.name'));

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/user/apply-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          name.trim(),
          address:       address.trim() || undefined,
          lat:           lat ?? undefined,
          lng:           lng ?? undefined,
          category:      category || undefined,
          contact_phone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'ALREADY_BUSINESS_OWNER')      return setError(t('apply.err.owner'));
        if (data.error === 'APPLICATION_ALREADY_PENDING') return setError(t('apply.err.pending'));
        return setError(t('apply.err.generic'));
      }
      setExisting(data.application);
      setSuccess(true);
    } catch {
      setError(t('apply.err.conn'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderBottom: `1px solid ${C.b1}`,
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,16,24,0.98)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', padding: 6,
          cursor: 'pointer', color: C.t2, display: 'flex', borderRadius: 10,
          WebkitTapHighlightColor: 'transparent',
        }}>
          <ArrowLeft size={20} strokeWidth={2} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Store size={18} color={C.geo} strokeWidth={1.75} />
          <span style={{ fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: FF.body }}>
            {t('apply.title')}
          </span>
        </div>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: 480, margin: '0 auto' }}>

        {loadingInit && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Loader2 size={28} color={C.geo} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {!loadingInit && existing && (
          <>
            <StatusBanner application={existing} />
            {existing.status === 'rejected' && (
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <RippleButton
                  onClick={() => { setExisting(null); setSuccess(false); setError(''); }}
                  style={{
                    background: C.geoDim, border: `1px solid ${C.geoGl}`,
                    color: C.geo, borderRadius: 12, padding: '12px 28px',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FF.body,
                  }}
                >
                  {t('apply.reapply')}
                </RippleButton>
              </div>
            )}
          </>
        )}

        {!loadingInit && !existing && (
          <>
            <div style={{
              ...cardBase, padding: '18px 16px', marginBottom: 28,
              background: C.geoDim, border: `1px solid ${C.geoGl}`,
            }}>
              <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.6 }}>
                {t('apply.intro')}
              </div>
            </div>

            {success && (
              <div style={{
                ...cardBase, padding: '20px 18px', marginBottom: 24,
                background: C.greenFt, border: `1px solid ${C.greenGl}`,
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                <CheckCircle size={24} color={C.green} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 4 }}>{t('apply.success.title')}</div>
                  <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.55 }}>
                    {t('apply.success.sub')}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <Field
                label={t('apply.form.name')} required
                value={name} onChange={setName}
                placeholder={t('apply.form.name_ph')}
              />

              {/* Location picker */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                  {t('apply.form.location')}
                </div>

                {/* Map pick button */}
                <button
                  type="button"
                  onClick={() => setMapOpen(true)}
                  style={{
                    width: '100%', padding: '13px 16px',
                    borderRadius: 12, border: `1px solid ${lat ? C.geoGl : 'rgba(255,255,255,0.10)'}`,
                    background: lat ? C.geoDim : 'rgba(255,255,255,0.04)',
                    color: lat ? C.geo : C.t3,
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: 'pointer', textAlign: 'left',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <MapPin size={16} color={lat ? C.geo : C.t3} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: lat ? 600 : 400, fontFamily: FF.body, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lat ? (address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`) : t('apply.form.pick_map')}
                  </span>
                  {lat && (
                    <span
                      onClick={e => { e.stopPropagation(); setLat(null); setLng(null); setAddress(''); }}
                      style={{ padding: 4, flexShrink: 0, color: C.t3, display: 'flex' }}
                    >
                      <X size={13} />
                    </span>
                  )}
                </button>

                {/* Manual address field below (editable, auto-filled from geocoding) */}
                <div style={{ marginTop: 10 }}>
                  <Field
                    label={t('apply.form.address_label')}
                    value={address}
                    onChange={setAddress}
                    placeholder={t('apply.form.address_ph')}
                    hint={lat ? undefined : t('apply.form.address_hint')}
                  />
                </div>
              </div>

              <SelectField label={t('apply.form.category')} value={category} onChange={setCategory} />
              <Field
                label={t('apply.form.phone')}
                value={phone} onChange={setPhone}
                placeholder="+998 90 123 45 67"
                inputMode="tel"
                hint={t('apply.form.phone_hint')}
              />

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: C.redFt, border: `1px solid ${C.redGl}`,
                  borderRadius: 12, padding: '12px 14px', marginBottom: 18,
                }}>
                  <AlertTriangle size={16} color={C.red} strokeWidth={2} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: C.red, fontWeight: 600 }}>{error}</span>
                </div>
              )}

              <RippleButton
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
                  background: submitting ? C.geoDim : C.geo,
                  color: submitting ? C.t3 : C.bg,
                  fontSize: 16, fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: FF.body,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.2s',
                  boxShadow: submitting ? 'none' : '0 6px 24px rgba(201,123,71,0.30)',
                }}
              >
                {submitting
                  ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> {t('apply.form.submitting')}</>
                  : t('apply.form.submit')
                }
              </RippleButton>
            </form>
          </>
        )}
      </div>

      {mapOpen && (
        <MapPickerSheet
          initialPos={lat ? { lat, lng } : null}
          onConfirm={handleMapConfirm}
          onClose={() => setMapOpen(false)}
        />
      )}
    </div>
  );
}
