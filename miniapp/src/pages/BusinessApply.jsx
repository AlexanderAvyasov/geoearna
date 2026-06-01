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

const CATEGORIES = [
  'Кафе / Ресторан',
  'Магазин',
  'Аптека',
  'Салон красоты',
  'Спортзал / Фитнес',
  'Автосервис',
  'Другое',
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

// ── Map picker sheet ──────────────────────────────────────────────────────────
function MapPickerSheet({ initialPos, onConfirm, onClose }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markerRef    = useRef(null);
  const [pos,         setPos]         = useState(initialPos || null);
  const [geocoding,   setGeocoding]   = useState(false);
  const [locating,    setLocating]    = useState(false);
  const [address,     setAddress]     = useState('');

  // Init Leaflet after mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: initialPos ? [initialPos.lat, initialPos.lng] : DEFAULT_CENTER,
      zoom: initialPos ? 16 : 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
    }).addTo(map);

    const icon = L.divIcon({
      html: `<div style="
        width:32px;height:32px;border-radius:50% 50% 50% 0;
        background:${C.geo};border:3px solid #fff;
        transform:rotate(-45deg);
        box-shadow:0 2px 10px rgba(0,0,0,0.5);
      "></div>`,
      iconSize: [32, 32], iconAnchor: [16, 32], className: '',
    });

    if (initialPos) {
      const m = L.marker([initialPos.lat, initialPos.lng], { icon, draggable: true }).addTo(map);
      markerRef.current = m;
      m.on('dragend', () => {
        const { lat, lng } = m.getLatLng();
        updatePos(lat, lng);
      });
    }

    map.on('click', e => {
      const { lat, lng } = e.latlng;
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
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const icon = L.divIcon({
            html: `<div style="
              width:32px;height:32px;border-radius:50% 50% 50% 0;
              background:${C.geo};border:3px solid #fff;
              transform:rotate(-45deg);
              box-shadow:0 2px 10px rgba(0,0,0,0.5);
            "></div>`,
            iconSize: [32, 32], iconAnchor: [16, 32], className: '',
          });
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
          zIndex: 300, animation: 'backdropIn 0.2s ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#0D1520',
        borderRadius: '22px 22px 0 0',
        border: '0.5px solid rgba(255,255,255,0.10)', borderBottom: 'none',
        zIndex: 301, maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.32s cubic-bezier(0.22,1,0.36,1)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '92vh',
      }}>
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', margin: '12px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px 12px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color={C.geo} strokeWidth={1.75} />
            <span style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>Отметьте место на карте</span>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.07)', border: 'none',
            width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
            <X size={13} color={C.t3} />
          </button>
        </div>

        <div style={{ fontSize: 12, color: C.t3, padding: '0 18px 12px', flexShrink: 0 }}>
          Нажмите на карту чтобы поставить метку
        </div>

        {/* Map */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div ref={containerRef} style={{ height: '48vmax', maxHeight: 320, minHeight: 200 }} />

          {/* My location button */}
          <button
            onClick={goToMyLocation}
            style={{
              position: 'absolute', bottom: 12, right: 12, zIndex: 999,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(8,16,24,0.92)',
              border: `1px solid rgba(255,255,255,0.15)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            {locating
              ? <Loader2 size={18} color={C.geo} style={{ animation: 'spin 1s linear infinite' }} />
              : <Crosshair size={18} color={C.geo} strokeWidth={1.75} />
            }
          </button>
        </div>

        {/* Address preview */}
        <div style={{
          padding: '14px 18px',
          flexShrink: 0,
          minHeight: 52,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {pos ? (
            <>
              <MapPin size={14} color={C.geo} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: C.t2, lineHeight: 1.4 }}>
                {geocoding
                  ? <span style={{ color: C.t3 }}>Определяем адрес…</span>
                  : address || `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
                }
              </span>
            </>
          ) : (
            <span style={{ fontSize: 13, color: C.t3 }}>Метка не установлена</span>
          )}
        </div>

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
            {geocoding ? 'Определяем адрес…' : 'Подтвердить место'}
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
        <option value="">— не выбрано —</option>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

function StatusBanner({ application }) {
  const cfg = {
    pending:  { icon: Clock,       color: C.gold,  bg: C.goldFt,  title: 'Заявка на рассмотрении', sub: 'Мы проверяем вашу заявку. Обычно это занимает 1–2 рабочих дня.' },
    approved: { icon: CheckCircle, color: C.green, bg: C.greenFt, title: 'Заявка одобрена!',        sub: 'Ваш бизнес-аккаунт активирован. Перейдите в раздел Бизнес.' },
    rejected: { icon: XCircle,     color: C.red,   bg: C.redFt,   title: 'Заявка отклонена',        sub: application?.review_note || 'Свяжитесь с поддержкой для уточнения причины.' },
  };
  const { icon: Icon, color, bg, title, sub } = cfg[application.status] || cfg.pending;
  return (
    <div style={{
      ...cardBase, padding: '20px 18px', marginBottom: 24,
      background: bg, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <Icon size={24} color={color} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.55 }}>{sub}</div>
        <div style={{ fontSize: 11, color: C.t3, marginTop: 8 }}>
          Заявка №{application.id} · {new Date(application.created_at).toLocaleDateString('ru-RU')}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BusinessApply() {
  const navigate = useNavigate();

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
    if (!name.trim()) return setError('Введите название заведения');

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
        if (data.error === 'ALREADY_BUSINESS_OWNER')      return setError('У вас уже есть бизнес-аккаунт');
        if (data.error === 'APPLICATION_ALREADY_PENDING') return setError('Заявка уже отправлена и ожидает рассмотрения');
        return setError('Ошибка при отправке заявки. Попробуйте ещё раз.');
      }
      setExisting(data.application);
      setSuccess(true);
    } catch {
      setError('Нет соединения. Попробуйте ещё раз.');
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
            Стать партнёром
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
                  Подать повторно
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
                Заполните форму — мы рассмотрим заявку и свяжемся с вами через Telegram.
                После одобрения вы получите доступ к панели бизнеса и сможете создавать кампании.
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
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 4 }}>Заявка отправлена!</div>
                  <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.55 }}>
                    Мы уведомим вас в Telegram когда заявка будет рассмотрена.
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <Field
                label="Название заведения" required
                value={name} onChange={setName}
                placeholder="Например: Кафе «Уют»"
              />

              {/* Location picker */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                  Местоположение
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
                    {lat ? (address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`) : 'Отметить на карте'}
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
                    label="Адрес (текстом)"
                    value={address}
                    onChange={setAddress}
                    placeholder="Заполняется автоматически или вручную"
                    hint={lat ? undefined : 'Или введите адрес вручную'}
                  />
                </div>
              </div>

              <SelectField label="Категория" value={category} onChange={setCategory} />
              <Field
                label="Контактный телефон"
                value={phone} onChange={setPhone}
                placeholder="+998 90 123 45 67"
                inputMode="tel"
                hint="Для связи по вопросам заявки"
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
                  ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Отправляем…</>
                  : 'Отправить заявку'
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
