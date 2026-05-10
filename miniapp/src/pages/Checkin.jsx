import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  MapPin, Clock, ClipboardList, Link2, Lock, Key, Ban, Timer,
  XCircle, Wifi, CheckCircle, AlertTriangle, PauseCircle, Gem,
  Shield, Zap, Star,
} from 'lucide-react';
import { useLocation } from '../hooks/useLocation';
import { tg } from '../hooks/useTelegram';
import RippleButton from '../lib/RippleButton';
import { apiFetch } from '../lib/api';
import { formatGeo } from '../lib/geo';
import { C, G } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';

// ─── Rarity config ────────────────────────────────────────────────────────────

const RARITY = {
  common:    { label: 'Common',    color: '#9CA3AF', glow: 'rgba(156,163,175,0.30)', bg: 'rgba(156,163,175,0.08)', grad: 'linear-gradient(135deg,#374151,#9CA3AF)',    Icon: Shield },
  rare:      { label: 'Rare',      color: '#60A5FA', glow: 'rgba(96,165,250,0.40)',  bg: 'rgba(96,165,250,0.08)',  grad: 'linear-gradient(135deg,#1D4ED8,#60A5FA)',    Icon: Star   },
  epic:      { label: 'Epic',      color: '#C084FC', glow: 'rgba(192,132,252,0.45)', bg: 'rgba(192,132,252,0.08)', grad: 'linear-gradient(135deg,#7C3AED,#C084FC)',    Icon: Gem    },
  legendary: { label: 'Legendary', color: '#FBBF24', glow: 'rgba(251,191,36,0.55)', bg: 'rgba(251,191,36,0.08)',  grad: 'linear-gradient(135deg,#B45309,#FBBF24)',    Icon: Zap    },
};

// ─── Error maps (keys only — resolved via t() in render) ─────────────────────

const ERRORS = {
  TOO_FAR:            { Icon: MapPin,        titleKey: 'err.TOO_FAR.title',            textKey: 'err.TOO_FAR.text' },
  TOO_SOON:           { Icon: Clock,         titleKey: 'err.TOO_SOON.title',           textKey: 'err.TOO_SOON.text' },
  NO_ACTIVE_CAMPAIGN: { Icon: ClipboardList, titleKey: 'err.NO_ACTIVE_CAMPAIGN.title', textKey: 'err.NO_ACTIVE_CAMPAIGN.text' },
  INVALID_QR_TOKEN:   { Icon: Link2,         titleKey: 'err.INVALID_QR_TOKEN.title',   textKey: 'err.INVALID_QR_TOKEN.text' },
  PIN_REQUIRED:       { Icon: Lock,          titleKey: 'err.PIN_REQUIRED.title',       textKey: 'err.PIN_REQUIRED.text' },
  INVALID_PIN:        { Icon: Key,           titleKey: 'err.INVALID_PIN.title',        textKey: 'err.INVALID_PIN.text' },
  PIN_USED:           { Icon: Ban,           titleKey: 'err.PIN_USED.title',           textKey: 'err.PIN_USED.text' },
  PIN_EXPIRED:        { Icon: Timer,         titleKey: 'err.PIN_EXPIRED.title',        textKey: 'err.PIN_EXPIRED.text' },
};

const PROMO_ERRORS = {
  NOT_FOUND:           { Icon: Link2,        titleKey: 'promo.NOT_FOUND.title',           textKey: 'promo.NOT_FOUND.text' },
  PROMO_INACTIVE:      { Icon: PauseCircle,  titleKey: 'promo.PROMO_INACTIVE.title',      textKey: 'promo.PROMO_INACTIVE.text' },
  PROMO_EXPIRED:       { Icon: Clock,        titleKey: 'promo.PROMO_EXPIRED.title',       textKey: 'promo.PROMO_EXPIRED.text' },
  PROMO_EXHAUSTED:     { Icon: XCircle,      titleKey: 'promo.PROMO_EXHAUSTED.title',     textKey: 'promo.PROMO_EXHAUSTED.text' },
  TOO_FAR:             { Icon: MapPin,       titleKey: 'promo.TOO_FAR.title',             textKey: 'promo.TOO_FAR.text' },
  ALREADY_CLAIMED:     { Icon: CheckCircle,  titleKey: 'promo.ALREADY_CLAIMED.title',     textKey: 'promo.ALREADY_CLAIMED.text' },
  COOLDOWN:            { Icon: Timer,        titleKey: 'promo.COOLDOWN.title',            textKey: 'promo.COOLDOWN.text' },
  DAILY_LIMIT_REACHED: { Icon: Ban,          titleKey: 'promo.DAILY_LIMIT_REACHED.title', textKey: 'promo.DAILY_LIMIT_REACHED.text' },
  USER_BANNED:         { Icon: Ban,          titleKey: 'promo.USER_BANNED.title',         textKey: 'promo.USER_BANNED.text' },
};

// ─── Particle burst (25 particles, randomized) ───────────────────────────────

const PARTICLE_COLORS = [C.geo, C.green, C.gold, '#fff', C.geo, C.geo];
const MILESTONE_GEO = { 7: 500, 14: 1500, 30: 5000 };

function genParticles() {
  return Array.from({ length: 25 }, (_, i) => {
    const angle = (i / 25) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist  = 70 + Math.random() * 130;
    return {
      tx:    `${(Math.cos(angle) * dist).toFixed(1)}px`,
      ty:    `${(Math.sin(angle) * dist).toFixed(1)}px`,
      delay: `${(i * 0.022).toFixed(3)}s`,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      size:  5 + Math.random() * 9,
      dur:   0.75 + Math.random() * 0.45,
    };
  });
}

const PARTICLES = genParticles();

// ─── Component ────────────────────────────────────────────────────────────────

export default function Checkin() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const token      = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const isPromo    = useMemo(() => searchParams.get('promo') === '1', [searchParams]);
  const isGeohunt  = useMemo(() => searchParams.get('geohunt') === '1', [searchParams]);

  const { lat, lng, error: locError, loading: locLoading, retry: retryGeo } = useLocation();

  const [status,       setStatus]       = useState('loading');
  const [reward,       setReward]       = useState(null);
  const [errInfo,      setErrInfo]      = useState(null);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [promoInfo,    setPromoInfo]    = useState(null);
  const [huntInfo,     setHuntInfo]     = useState(null);
  const [pin,          setPin]          = useState('');
  const [pinError,     setPinError]     = useState('');
  const [showBurst,          setShowBurst]          = useState(false);
  const [showWave,           setShowWave]           = useState(false);
  const [streakMilestone,    setStreakMilestone]    = useState(null);
  const pinRef = useRef(null);
  const sent   = useRef(false);

  const rarity = promoInfo?.rarity;
  const RC     = RARITY[rarity] || null;

  // ── Fetch info ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setErrInfo({ Icon: Link2, titleKey: 'err.NO_TOKEN.title', textKey: 'err.NO_TOKEN.text' });
      setStatus('error');
      return;
    }

    if (isGeohunt) {
      apiFetch(`/api/geohunt/info?token=${encodeURIComponent(token)}`)
        .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
        .then(({ ok, data }) => {
          if (!ok) {
            const GEOHUNT_ERRORS = {
              NOT_FOUND:        { Icon: Link2,        titleKey: 'err.INVALID_QR_TOKEN.title', textKey: 'err.INVALID_QR_TOKEN.text' },
              HUNT_INACTIVE:    { Icon: PauseCircle,  titleKey: 'promo.PROMO_INACTIVE.title', textKey: 'promo.PROMO_INACTIVE.text' },
              HUNT_EXPIRED:     { Icon: Clock,        titleKey: 'promo.PROMO_EXPIRED.title',  textKey: 'promo.PROMO_EXPIRED.text' },
              HUNT_NOT_STARTED: { Icon: Timer,        titleKey: 'promo.PROMO_INACTIVE.title', textKey: 'promo.PROMO_INACTIVE.text' },
              CODE_USED:        { Icon: XCircle,      titleKey: 'promo.PROMO_EXHAUSTED.title', textKey: 'promo.PROMO_EXHAUSTED.text' },
            };
            const code = data?.error || 'UNKNOWN';
            setErrInfo(GEOHUNT_ERRORS[code] || { Icon: XCircle, titleKey: 'err.UNKNOWN.title', textKey: 'err.UNKNOWN.text' });
            setStatus('error');
          } else {
            setHuntInfo(data);
          }
        })
        .catch(() => {
          setErrInfo({ Icon: Wifi, titleKey: 'err.NO_CONNECTION.title', textKey: 'err.NO_CONNECTION.text' });
          setStatus('error');
        });
      return;
    }

    const endpoint = isPromo
      ? `/api/promo/info?token=${encodeURIComponent(token)}`
      : `/api/checkin/info?token=${encodeURIComponent(token)}`;

    apiFetch(endpoint)
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) {
          const code = data?.error || 'UNKNOWN';
          const map = isPromo ? PROMO_ERRORS : ERRORS;
          setErrInfo(map[code] || { Icon: XCircle, titleKey: 'err.UNKNOWN.title', textKey: 'err.UNKNOWN.text' });
          setStatus('error');
        } else {
          if (isPromo) setPromoInfo(data);
          else         setBusinessInfo(data);
        }
      })
      .catch(() => {
        setErrInfo({ Icon: Wifi, titleKey: 'err.NO_CONNECTION.title', textKey: 'err.NO_CONNECTION.text' });
        setStatus('error');
      });
  }, [token, isPromo, isGeohunt]);

  // ── GeoHunt: auto-submit as soon as info loads (no location needed) ──────────

  useEffect(() => {
    if (!isGeohunt || !huntInfo || sent.current || status === 'error') return;
    doGeohunt();
  }, [huntInfo, isGeohunt]);

  // ── Auto-submit when ready (business + promo) ────────────────────────────────

  useEffect(() => {
    if (isGeohunt || sent.current || status === 'error') return;
    const info = isPromo ? promoInfo : businessInfo;
    if (!info) return;

    if (locError) {
      setErrInfo({
        Icon: MapPin,
        titleKey: locError === 'denied_hard' ? 'err.GEO_DENIED_HARD.title' : 'err.GEO_DENIED.title',
        textKey:  locError === 'denied_hard' ? 'err.GEO_DENIED_HARD.text'  : 'err.GEO_DENIED.text',
        showRetry: locError === 'denied',
        showSettings: locError === 'denied_hard',
      });
      setStatus('error');
      return;
    }
    if (locLoading || lat == null || lng == null) return;

    if (!isPromo && businessInfo?.requiresPin) {
      setStatus('pin');
      setTimeout(() => pinRef.current?.focus(), 300);
    } else {
      isPromo ? doPromo() : doCheckin(null);
    }
  }, [businessInfo, promoInfo, locLoading, locError, lat, lng]);

  // ── Checkin (business) ──────────────────────────────────────────────────────

  async function doCheckin(pinValue) {
    if (sent.current) return;
    sent.current = true;
    setStatus('submitting');
    try {
      const r = await apiFetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: token, lat, lng, pin: pinValue || undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const code = data?.error || 'UNKNOWN';
        if (['PIN_REQUIRED', 'INVALID_PIN', 'PIN_USED', 'PIN_EXPIRED'].includes(code)) {
          sent.current = false;
          const pinErrKey = (ERRORS[code] || {}).textKey || 'err.UNKNOWN.text';
          setPinError(t(pinErrKey));
          setStatus('pin');
          setPin('');
        } else {
          setErrInfo(ERRORS[code] || { Icon: XCircle, titleKey: 'err.UNKNOWN.title', textKey: 'err.UNKNOWN.text' });
          setStatus('error');
        }
      } else {
        setReward(data.reward);
        setStatus('success');
        setShowBurst(true);
        setShowWave(true);
        setTimeout(() => setShowBurst(false), 1400);
        setTimeout(() => setShowWave(false), 900);
        const ms = data.streakInfo?.projected;
        if ([7, 14, 30].includes(ms)) {
          setTimeout(() => {
            setStreakMilestone(ms);
            setTimeout(() => tg?.HapticFeedback?.notificationOccurred('success'), 100);
          }, 500);
        }
      }
    } catch {
      setErrInfo({ Icon: Wifi, titleKey: 'err.NO_CONNECTION.title', textKey: 'err.NO_CONNECTION.text' });
      setStatus('error');
    }
  }

  // ── Promo claim ─────────────────────────────────────────────────────────────

  async function doPromo() {
    if (sent.current) return;
    sent.current = true;
    setStatus('submitting');
    try {
      const r = await apiFetch('/api/promo/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, lat, lng }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const code = data?.error || 'UNKNOWN';
        setErrInfo(PROMO_ERRORS[code] || { Icon: XCircle, titleKey: 'err.UNKNOWN.title', textKey: 'err.UNKNOWN.text' });
        setStatus('error');
      } else {
        setReward(data.reward);
        setPromoInfo(prev => ({ ...prev, rarity: data.rarity, title: data.title }));
        setStatus('success');
        setShowBurst(true);
        setShowWave(true);
        setTimeout(() => setShowBurst(false), 1400);
        setTimeout(() => setShowWave(false), 900);
      }
    } catch {
      setErrInfo({ Icon: Wifi, titleKey: 'err.NO_CONNECTION.title', textKey: 'err.NO_CONNECTION.text' });
      setStatus('error');
    }
  }

  // ── GeoHunt claim ───────────────────────────────────────────────────────────

  async function doGeohunt() {
    if (sent.current) return;
    sent.current = true;
    setStatus('submitting');
    try {
      const r = await apiFetch('/api/geohunt/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const GEOHUNT_CLAIM_ERRORS = {
          CODE_USED:              { Icon: XCircle,     titleKey: 'promo.PROMO_EXHAUSTED.title', textKey: 'promo.PROMO_EXHAUSTED.text' },
          ALREADY_CLAIMED_BY_YOU: { Icon: CheckCircle, titleKey: 'promo.ALREADY_CLAIMED.title', textKey: 'promo.ALREADY_CLAIMED.text' },
          HUNT_INACTIVE:          { Icon: PauseCircle, titleKey: 'promo.PROMO_INACTIVE.title',  textKey: 'promo.PROMO_INACTIVE.text' },
          HUNT_EXPIRED:           { Icon: Clock,       titleKey: 'promo.PROMO_EXPIRED.title',   textKey: 'promo.PROMO_EXPIRED.text' },
        };
        const code = data?.error || 'UNKNOWN';
        setErrInfo(GEOHUNT_CLAIM_ERRORS[code] || { Icon: XCircle, titleKey: 'err.UNKNOWN.title', textKey: 'err.UNKNOWN.text' });
        setStatus('error');
      } else {
        setReward(data.reward);
        setHuntInfo(prev => ({ ...prev, huntTitle: data.huntTitle }));
        setStatus('success');
        setShowBurst(true);
        setShowWave(true);
        setTimeout(() => setShowBurst(false), 1400);
        setTimeout(() => setShowWave(false), 900);
        tg?.HapticFeedback?.notificationOccurred('success');
      }
    } catch {
      setErrInfo({ Icon: Wifi, titleKey: 'err.NO_CONNECTION.title', textKey: 'err.NO_CONNECTION.text' });
      setStatus('error');
    }
  }

  function handlePinSubmit(e) {
    e.preventDefault();
    if (pin.length < 4) { setPinError(t('checkin.pin.min_digits')); return; }
    setPinError('');
    doCheckin(pin);
  }

  // ── Loading spinner color ────────────────────────────────────────────────────

  const spinColor = RC ? RC.color : '#C6F135';
  const spinBg    = RC ? RC.glow  : 'rgba(198,241,53,0.08)';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px',
      background: C.bg,
      textAlign: 'center',
      transition: 'background 0.6s ease',
    }}>
      {/* WAVE RISE */}
      {showWave && (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 198,
          background: `linear-gradient(0deg, rgba(198,241,53,0.18) 0%, rgba(198,241,53,0.06) 60%, transparent 100%)`,
          animation: 'waveRise 0.85s ease-out both',
        }} />
      )}

      {/* PARTICLE BURST — 25 particles */}
      {showBurst && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {PARTICLES.map((p, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: p.size, height: p.size, borderRadius: '50%',
              background: RC ? RC.color : p.color,
              boxShadow: `0 0 ${p.size * 1.2}px ${RC ? RC.color : p.color}`,
              '--tx': p.tx, '--ty': p.ty,
              animation: `coinBurst ${p.dur}s ${p.delay} cubic-bezier(0.22,0.61,0.36,1) forwards`,
            }} />
          ))}
        </div>
      )}

      {/* STREAK MILESTONE OVERLAY */}
      {streakMilestone && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: C.bg,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '32px 24px',
          animation: 'pageEnter 0.3s ease both',
        }}>
          {/* Rays */}
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: `rotate(${i * 45}deg)`,
              transformOrigin: '0 0',
              width: 2,
            }}>
              <div style={{
                width: 3, height: 90,
                background: `linear-gradient(to top, ${C.geo}cc, transparent)`,
                borderRadius: 2,
                marginLeft: -1.5,
                marginTop: -130,
                transformOrigin: 'bottom center',
                animation: `rayBurst 1s cubic-bezier(0.22,1,0.36,1) ${i * 0.05}s both`,
              }} />
            </div>
          ))}

          {/* Big streak number */}
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 110, fontWeight: 900, letterSpacing: -5,
            color: C.geo, lineHeight: 1,
            textShadow: `0 0 40px ${C.geoGl}, 0 0 80px ${C.geoDim}`,
            animation: 'streakPop 0.65s cubic-bezier(0.175,0.885,0.32,1.275) both',
          }}>
            {streakMilestone}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 2, marginTop: 4, animation: 'fadeUp 0.4s 0.3s ease both' }}>
            DAYS STREAK 🔥
          </div>

          {/* Bonus card */}
          <div style={{
            marginTop: 28,
            background: C.geoDim, border: `1px solid ${C.geoGl}`,
            borderRadius: 18, padding: '18px 32px', textAlign: 'center',
            animation: 'fadeUp 0.4s 0.45s ease both',
          }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: C.geo, fontWeight: 900, fontSize: 32, letterSpacing: -1 }}>
              +{MILESTONE_GEO[streakMilestone].toLocaleString('ru-RU')} GEO
            </div>
            <div style={{ color: C.t3, fontSize: 13, marginTop: 4 }}>Milestone bonus credited!</div>
          </div>

          <RippleButton
            onClick={() => setStreakMilestone(null)}
            style={{
              marginTop: 32,
              background: C.geo, color: C.bg,
              border: 'none', padding: '14px 40px',
              borderRadius: 14, fontWeight: 800, fontSize: 16,
              cursor: 'pointer', letterSpacing: 0.5,
              fontFamily: "'Barlow Condensed', sans-serif",
              animation: 'fadeUp 0.4s 0.6s ease both',
            }}
          >
            Continue
          </RippleButton>
        </div>
      )}

      {/* LOADING / SUBMITTING */}
      {(status === 'loading' || status === 'submitting') && (
        <>
          <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 28 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: spinBg, animation: 'ripple 1.6s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: spinBg, animation: 'ripple 1.6s ease-out 0.5s infinite' }} />
            <div style={{
              position: 'relative', zIndex: 1,
              width: 96, height: 96, borderRadius: '50%',
              background: C.surf, border: `1px solid ${spinColor}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MapPin size={38} color={spinColor} strokeWidth={1.75} />
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10, color: C.t1 }}>
            {status === 'submitting'
              ? (isGeohunt ? 'Активируем GeoHunt…' : isPromo ? t('checkin.submitting_promo') : t('checkin.submitting_biz'))
              : t('checkin.loading')}
          </div>
          <div style={{ color: C.t3, fontSize: 15, lineHeight: 1.5 }}>
            {status === 'submitting'
              ? t('checkin.wait')
              : isGeohunt
                ? 'Проверяем код…'
                : locLoading
                  ? t('checkin.locating')
                  : t('checkin.verifying')}
          </div>
          {isPromo && promoInfo && status === 'loading' && (
            <div style={{
              marginTop: 24, padding: '12px 20px', borderRadius: 14,
              background: RC ? RC.bg : 'transparent',
              border: `1px solid ${RC ? RC.color + '40' : 'transparent'}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: RC ? RC.color : C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                {RC ? RC.label : 'Promo'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{promoInfo.title}</div>
              <div style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>+{formatGeo(promoInfo.reward)} GEO</div>
            </div>
          )}
        </>
      )}

      {/* PIN INPUT (business only) */}
      {status === 'pin' && businessInfo && (
        <div style={{ width: '100%', maxWidth: 360, animation: 'fadeUp 0.4s ease both' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%', background: G.gold,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', boxShadow: `0 6px 28px ${C.goldGl}`,
            animation: 'pop 0.45s cubic-bezier(0.175,0.885,0.32,1.275)',
          }}>
            <Lock size={38} color="#1a0800" strokeWidth={2} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 6, color: C.t1 }}>{t('checkin.pin.title')}</div>
          <div style={{ color: C.purpleL, fontSize: 15, marginBottom: 6, fontWeight: 600 }}>{businessInfo.businessName}</div>
          <div style={{ color: C.t3, fontSize: 14, marginBottom: 28, lineHeight: 1.4 }}>
            {t('checkin.pin.ask')}
          </div>
          <form onSubmit={handlePinSubmit}>
            <input
              ref={pinRef}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinError(''); }}
              inputMode="numeric"
              placeholder="• • • • • •"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '18px', borderRadius: 16,
                border: `1px solid ${pinError ? C.red : pin.length >= 4 ? 'rgba(198,241,53,0.45)' : C.b2}`,
                background: C.surf, color: C.t1,
                fontSize: 28, fontWeight: 700, textAlign: 'center', letterSpacing: 10,
                outline: 'none', transition: 'border-color 0.15s', marginBottom: 12,
                fontFamily: "'Barlow Condensed', -apple-system, sans-serif",
              }}
            />
            {pinError && (
              <div style={{
                background: C.redFt, color: C.red, borderRadius: 10,
                padding: '10px 12px', fontSize: 14, fontWeight: 600,
                marginBottom: 16, border: `1px solid rgba(239,68,68,0.2)`,
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <AlertTriangle size={15} color={C.red} strokeWidth={2} style={{ flexShrink: 0 }} />
                {pinError}
              </div>
            )}
            <button type="submit" disabled={pin.length < 4} style={{
              width: '100%',
              background: pin.length >= 4 ? '#C6F135' : C.cardHi,
              color: pin.length >= 4 ? '#090B10' : C.t3,
              border: `1px solid ${pin.length >= 4 ? 'transparent' : C.b2}`,
              padding: '15px', borderRadius: 13,
              fontWeight: 700, fontSize: 15,
              cursor: pin.length >= 4 ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
            }}>
              {t('checkin.pin.confirm')}
            </button>
          </form>
          {businessInfo.reward > 0 && (
            <div style={{ marginTop: 22, color: C.t3, fontSize: 13 }}>
              {t('checkin.pin.reward')} <strong style={{ color: C.purpleL }}>+{formatGeo(businessInfo.reward)} GEO</strong>
            </div>
          )}
        </div>
      )}

      {/* SUCCESS */}
      {status === 'success' && (() => {
        // Derive accent based on mode
        const accentColor = isGeohunt ? C.gold : isPromo && RC ? RC.color : '#C6F135';
        const accentBg    = isGeohunt ? C.goldFt : isPromo && RC ? RC.bg : 'rgba(198,241,53,0.08)';
        const accentBorder= isGeohunt ? C.goldGl  : isPromo && RC ? RC.color + '30' : 'rgba(198,241,53,0.20)';
        const accentGrad  = isGeohunt
          ? 'linear-gradient(135deg,#B45309,#FBBF24)'
          : isPromo && RC ? RC.grad : G.emerald;
        const accentGlow  = isGeohunt ? C.goldGl : isPromo && RC ? RC.glow : undefined;

        return (
          <>
            {/* GeoHunt badge */}
            {isGeohunt && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20,
                background: C.goldFt, border: `1px solid ${C.goldGl}`,
                marginBottom: 20, animation: 'fadeUp 0.3s ease both',
              }}>
                <Star size={13} color={C.gold} strokeWidth={2} />
                <span style={{ fontSize: 12, fontWeight: 800, color: C.gold, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  GeoHunt
                </span>
              </div>
            )}

            {/* Rarity badge for promo */}
            {!isGeohunt && isPromo && RC && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20,
                background: RC.bg, border: `1px solid ${RC.color}40`,
                marginBottom: 20, animation: 'fadeUp 0.3s ease both',
              }}>
                <RC.Icon size={13} color={RC.color} strokeWidth={2} />
                <span style={{ fontSize: 12, fontWeight: 800, color: RC.color, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  {RC.label}
                </span>
              </div>
            )}

            {/* Success icon */}
            <div style={{
              width: 116, height: 116, borderRadius: '50%',
              background: accentGrad,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 32,
              boxShadow: accentGlow ? `0 0 40px ${accentGlow}, 0 0 80px ${accentGlow}` : undefined,
              animation: 'pop 0.55s cubic-bezier(0.175,0.885,0.32,1.275), successGlow 2.5s 0.6s ease-in-out infinite',
            }}>
              <CheckCircle size={56} color="#fff" strokeWidth={2.5} />
            </div>

            <div style={{ fontWeight: 900, fontSize: 28, marginBottom: 6, color: C.t1, letterSpacing: -0.5, animation: 'fadeUp 0.4s 0.2s both' }}>
              {isGeohunt ? 'GeoHunt найден!' : isPromo ? t('checkin.success_promo') : t('checkin.success_biz')}
            </div>
            {isGeohunt && huntInfo?.huntTitle && (
              <div style={{ color: C.gold, fontSize: 14, marginBottom: 4, fontWeight: 700, animation: 'fadeUp 0.4s 0.22s both' }}>
                {huntInfo.huntTitle}
              </div>
            )}
            {!isGeohunt && isPromo && promoInfo?.title && (
              <div style={{ color: accentColor, fontSize: 14, marginBottom: 4, fontWeight: 700, animation: 'fadeUp 0.4s 0.22s both' }}>
                {promoInfo.title}
              </div>
            )}
            <div style={{ color: C.t3, fontSize: 14, marginBottom: 32, animation: 'fadeUp 0.4s 0.25s both' }}>
              {t('checkin.credited')}
            </div>

            {/* Reward card */}
            <div style={{
              background: accentBg,
              border: `1px solid ${accentBorder}`,
              borderRadius: 24, padding: '26px 44px', marginBottom: 36,
              animation: 'fadeUp 0.4s 0.3s both',
              boxShadow: accentGlow ? `0 0 32px ${accentGlow}` : undefined,
            }}>
              <div style={{ color: C.t3, fontSize: 11, marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {t('checkin.received')}
              </div>
              <div style={{ animation: 'pop 0.5s 0.45s both' }}>
                <div style={{
                  fontSize: 56, fontWeight: 900, letterSpacing: -2, lineHeight: 1,
                  color: accentColor,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  textShadow: accentGlow ? `0 0 20px ${accentGlow}` : undefined,
                }}>
                  +{formatGeo(reward)}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.t2, marginTop: 6 }}>GEO</div>
              </div>
            </div>

            <Link to="/balance" style={{
              display: 'block', width: '100%', maxWidth: 300,
              background: accentGrad,
              color: '#fff', textDecoration: 'none',
              padding: '15px 32px', borderRadius: 13,
              fontWeight: 700, fontSize: 15,
              boxShadow: accentGlow ? `0 6px 24px ${accentGlow}` : undefined,
              animation: 'fadeUp 0.4s 0.45s both',
            }}>
              {t('checkin.go_wallet')}
            </Link>
            <Link to="/" style={{
              display: 'block', marginTop: 18,
              color: C.t3, fontSize: 14,
              textDecoration: 'none', animation: 'fadeUp 0.4s 0.55s both',
            }}>
              {t('checkin.go_home')}
            </Link>
          </>
        );
      })()}

      {/* ERROR */}
      {status === 'error' && errInfo && (
        <>
          <div style={{
            width: 104, height: 104, borderRadius: '50%',
            background: C.surf, border: `1px solid rgba(239,68,68,0.2)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24, animation: 'pop 0.45s cubic-bezier(0.175,0.885,0.32,1.275)',
          }}>
            <errInfo.Icon size={48} color={C.red} strokeWidth={1.5} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10, color: C.t1 }}>
            {t(errInfo.titleKey)}
          </div>
          <div style={{ color: C.t3, fontSize: 15, lineHeight: 1.6, marginBottom: 36, maxWidth: 280, whiteSpace: 'pre-line' }}>
            {t(errInfo.textKey)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            {errInfo.showRetry && (
              <button onClick={retryGeo} style={{
                background: C.geo, color: C.bg, border: 'none',
                padding: '14px 36px', borderRadius: 16,
                fontWeight: 700, fontSize: 16, cursor: 'pointer',
              }}>
                {t('checkin.geo_allow')}
              </button>
            )}
            <Link to="/" style={{
              background: C.surf, border: `1px solid ${C.b2}`,
              color: C.purpleL, textDecoration: 'none',
              padding: '14px 36px', borderRadius: 16,
              fontWeight: 700, fontSize: 16,
            }}>
              {t('checkin.go_home_btn')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
