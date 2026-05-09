import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  MapPin, Clock, ClipboardList, Link2, Lock, Key, Ban, Timer,
  XCircle, Wifi, CheckCircle, AlertTriangle, PauseCircle, Gem,
  Shield, Zap, Star,
} from 'lucide-react';
import { useLocation } from '../hooks/useLocation';
import { apiFetch } from '../lib/api';
import { formatGeo } from '../lib/geo';
import { C, G, E } from '../lib/design';

// ─── Rarity config ────────────────────────────────────────────────────────────

const RARITY = {
  common:    { label: 'Common',    color: '#9CA3AF', glow: 'rgba(156,163,175,0.30)', bg: 'rgba(156,163,175,0.08)', grad: 'linear-gradient(135deg,#374151,#9CA3AF)',    Icon: Shield },
  rare:      { label: 'Rare',      color: '#60A5FA', glow: 'rgba(96,165,250,0.40)',  bg: 'rgba(96,165,250,0.08)',  grad: 'linear-gradient(135deg,#1D4ED8,#60A5FA)',    Icon: Star   },
  epic:      { label: 'Epic',      color: '#C084FC', glow: 'rgba(192,132,252,0.45)', bg: 'rgba(192,132,252,0.08)', grad: 'linear-gradient(135deg,#7C3AED,#C084FC)',    Icon: Gem    },
  legendary: { label: 'Legendary', color: '#FBBF24', glow: 'rgba(251,191,36,0.55)', bg: 'rgba(251,191,36,0.08)',  grad: 'linear-gradient(135deg,#B45309,#FBBF24)',    Icon: Zap    },
};

// ─── Error maps ───────────────────────────────────────────────────────────────

const ERRORS = {
  TOO_FAR:            { Icon: MapPin,        title: 'Слишком далеко',      text: 'Подойдите ближе к заведению и попробуйте снова.' },
  TOO_SOON:           { Icon: Clock,         title: 'Уже чекинились',      text: 'Вы недавно были в этом заведении. Возвращайтесь завтра!' },
  NO_ACTIVE_CAMPAIGN: { Icon: ClipboardList, title: 'Нет акции',            text: 'В данный момент нет активных акций для этого заведения.' },
  INVALID_QR_TOKEN:   { Icon: Link2,         title: 'Неверный QR',          text: 'QR-код недействителен. Попробуйте отсканировать заново.' },
  PIN_REQUIRED:       { Icon: Lock,          title: 'Нужен PIN',             text: 'Для этого заведения требуется PIN-код от сотрудника.' },
  INVALID_PIN:        { Icon: Key,           title: 'Неверный PIN',          text: 'Введённый PIN-код неверен. Попросите сотрудника повторить.' },
  PIN_USED:           { Icon: Ban,           title: 'PIN уже использован',  text: 'Этот PIN уже использован. Попросите новый.' },
  PIN_EXPIRED:        { Icon: Timer,         title: 'PIN устарел',           text: 'Срок действия PIN истёк. Попросите сотрудника сгенерировать новый.' },
};

const PROMO_ERRORS = {
  NOT_FOUND:           { Icon: Link2,        title: 'Промо не найдено',      text: 'QR-код недействителен или акция была удалена.' },
  PROMO_INACTIVE:      { Icon: PauseCircle,  title: 'Акция приостановлена',  text: 'Эта промо-акция временно недоступна.' },
  PROMO_EXPIRED:       { Icon: Clock,        title: 'Срок истёк',            text: 'Эта промо-акция уже завершилась.' },
  PROMO_EXHAUSTED:     { Icon: XCircle,      title: 'Все призы разобраны',   text: 'К сожалению, все GEO по этой акции уже получены.' },
  TOO_FAR:             { Icon: MapPin,       title: 'Слишком далеко',        text: 'Подойдите ближе к точке на карте и попробуйте снова.' },
  ALREADY_CLAIMED:     { Icon: CheckCircle,  title: 'Уже получено',          text: 'Вы уже получили награду по этой акции.' },
  COOLDOWN:            { Icon: Timer,        title: 'Подождите',             text: 'Вы сможете получить эту награду снова позже.' },
  DAILY_LIMIT_REACHED: { Icon: Ban,          title: 'Дневной лимит',         text: 'Вы достигли лимита промо-наград на сегодня (3/день).' },
  USER_BANNED:         { Icon: Ban,          title: 'Аккаунт заблокирован', text: 'Ваш аккаунт заблокирован.' },
};

// ─── Particle burst ───────────────────────────────────────────────────────────

const BURST_COLORS = [
  { tx: '-72px', ty: '-80px', delay: '0s',    color: C.purple  },
  { tx:   '0px', ty: '-96px', delay: '0.06s', color: C.purpleL },
  { tx:  '72px', ty: '-80px', delay: '0.04s', color: C.indigo  },
  { tx:  '96px', ty:   '0px', delay: '0.08s', color: C.gold    },
  { tx:  '72px', ty:  '80px', delay: '0.06s', color: C.purple  },
  { tx:   '0px', ty:  '96px', delay: '0.1s',  color: C.emerald },
  { tx: '-72px', ty:  '80px', delay: '0.04s', color: C.purpleL },
  { tx: '-96px', ty:   '0px', delay: '0.02s', color: C.indigo  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Checkin() {
  const [searchParams] = useSearchParams();
  const token   = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const isPromo = useMemo(() => searchParams.get('promo') === '1', [searchParams]);

  const { lat, lng, error: locError, loading: locLoading } = useLocation();

  const [status,       setStatus]       = useState('loading');
  const [reward,       setReward]       = useState(null);
  const [errInfo,      setErrInfo]      = useState(null);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [promoInfo,    setPromoInfo]    = useState(null);
  const [pin,          setPin]          = useState('');
  const [pinError,     setPinError]     = useState('');
  const [showBurst,    setShowBurst]    = useState(false);
  const pinRef = useRef(null);
  const sent   = useRef(false);

  const rarity = promoInfo?.rarity;
  const RC     = RARITY[rarity] || null;

  // ── Fetch info ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setErrInfo({ Icon: Link2, title: 'Нет токена', text: 'Откройте приложение через Telegram-бота или QR-код.' });
      setStatus('error');
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
          setErrInfo(map[code] || { Icon: XCircle, title: 'Ошибка', text: 'Не удалось загрузить акцию.' });
          setStatus('error');
        } else {
          if (isPromo) setPromoInfo(data);
          else         setBusinessInfo(data);
        }
      })
      .catch(() => {
        setErrInfo({ Icon: Wifi, title: 'Нет соединения', text: 'Проверьте интернет и попробуйте снова.' });
        setStatus('error');
      });
  }, [token, isPromo]);

  // ── Auto-submit when ready ──────────────────────────────────────────────────

  useEffect(() => {
    if (sent.current || status === 'error') return;
    const info = isPromo ? promoInfo : businessInfo;
    if (!info) return;

    if (locError) {
      setErrInfo({ Icon: MapPin, title: 'Нет геолокации', text: locError });
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
          setPinError((ERRORS[code] || {}).text || 'Ошибка PIN');
          setStatus('pin');
          setPin('');
        } else {
          setErrInfo(ERRORS[code] || { Icon: XCircle, title: 'Ошибка', text: 'Не удалось выполнить чекин.' });
          setStatus('error');
        }
      } else {
        setReward(data.reward);
        setStatus('success');
        setShowBurst(true);
        setTimeout(() => setShowBurst(false), 1200);
      }
    } catch {
      setErrInfo({ Icon: Wifi, title: 'Нет соединения', text: 'Проверьте интернет и попробуйте снова.' });
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
        setErrInfo(PROMO_ERRORS[code] || { Icon: XCircle, title: 'Ошибка', text: 'Не удалось получить награду.' });
        setStatus('error');
      } else {
        setReward(data.reward);
        setPromoInfo(prev => ({ ...prev, rarity: data.rarity, title: data.title }));
        setStatus('success');
        setShowBurst(true);
        setTimeout(() => setShowBurst(false), 1400);
      }
    } catch {
      setErrInfo({ Icon: Wifi, title: 'Нет соединения', text: 'Проверьте интернет и попробуйте снова.' });
      setStatus('error');
    }
  }

  function handlePinSubmit(e) {
    e.preventDefault();
    if (pin.length < 4) { setPinError('Введите PIN (4–6 цифр)'); return; }
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
      {/* PARTICLE BURST */}
      {showBurst && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {BURST_COLORS.map((c, i) => (
            <div key={i} style={{
              position: 'absolute', width: 10, height: 10, borderRadius: '50%',
              background: RC ? RC.color : c.color,
              boxShadow: `0 0 8px ${RC ? RC.color : c.color}`,
              '--tx': c.tx, '--ty': c.ty,
              animation: `coinBurst 1.0s ${c.delay} cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
            }} />
          ))}
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
            {status === 'submitting' ? (isPromo ? 'Получаем награду…' : 'Отправляем чекин…') : 'Загружаем акцию…'}
          </div>
          <div style={{ color: C.t3, fontSize: 15, lineHeight: 1.5 }}>
            {status === 'submitting' ? 'Подождите секунду…' : locLoading ? 'Определяем местоположение…' : 'Проверяем данные…'}
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
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 6, color: C.t1 }}>Введите PIN-код</div>
          <div style={{ color: C.purpleL, fontSize: 15, marginBottom: 6, fontWeight: 600 }}>{businessInfo.businessName}</div>
          <div style={{ color: C.t3, fontSize: 14, marginBottom: 28, lineHeight: 1.4 }}>
            Попросите сотрудника назвать PIN-код
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
                fontFamily: "'DM Sans', -apple-system, sans-serif",
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
              Подтвердить
            </button>
          </form>
          {businessInfo.reward > 0 && (
            <div style={{ marginTop: 22, color: C.t3, fontSize: 13 }}>
              Вознаграждение: <strong style={{ color: C.purpleL }}>+{formatGeo(businessInfo.reward)} GEO</strong>
            </div>
          )}
        </div>
      )}

      {/* SUCCESS */}
      {status === 'success' && (
        <>
          {/* Rarity badge for promo */}
          {isPromo && RC && (
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
            background: isPromo && RC ? RC.grad : G.emerald,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 32,
            boxShadow: isPromo && RC ? `0 0 40px ${RC.glow}, 0 0 80px ${RC.glow}` : undefined,
            animation: 'pop 0.55s cubic-bezier(0.175,0.885,0.32,1.275), successGlow 2.5s 0.6s ease-in-out infinite',
          }}>
            <CheckCircle size={56} color="#fff" strokeWidth={2.5} />
          </div>

          <div style={{ fontWeight: 900, fontSize: 28, marginBottom: 6, color: C.t1, letterSpacing: -0.5, animation: 'fadeUp 0.4s 0.2s both' }}>
            {isPromo ? 'Награда получена!' : 'Чекин выполнен!'}
          </div>
          {isPromo && promoInfo?.title && (
            <div style={{ color: isPromo && RC ? RC.color : C.t3, fontSize: 14, marginBottom: 4, fontWeight: 700, animation: 'fadeUp 0.4s 0.22s both' }}>
              {promoInfo.title}
            </div>
          )}
          <div style={{ color: C.t3, fontSize: 14, marginBottom: 32, animation: 'fadeUp 0.4s 0.25s both' }}>
            GEO‑монеты зачислены на ваш кошелёк
          </div>

          {/* Reward card */}
          <div style={{
            background: isPromo && RC ? RC.bg : 'rgba(198,241,53,0.08)',
            border: `1px solid ${isPromo && RC ? RC.color + '30' : 'rgba(198,241,53,0.20)'}`,
            borderRadius: 24, padding: '26px 44px', marginBottom: 36,
            animation: 'fadeUp 0.4s 0.3s both',
            boxShadow: isPromo && RC ? `0 0 32px ${RC.glow}` : undefined,
          }}>
            <div style={{ color: C.t3, fontSize: 11, marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Вы получили
            </div>
            <div style={{ animation: 'pop 0.5s 0.45s both' }}>
              <div style={{
                fontSize: 56, fontWeight: 900, letterSpacing: -2, lineHeight: 1,
                color: isPromo && RC ? RC.color : '#C6F135',
                fontFamily: "'Syne', sans-serif",
                textShadow: isPromo && RC ? `0 0 20px ${RC.glow}` : undefined,
              }}>
                +{formatGeo(reward)}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.t2, marginTop: 6 }}>GEO</div>
            </div>
          </div>

          <Link to="/balance" style={{
            display: 'block', width: '100%', maxWidth: 300,
            background: isPromo && RC ? RC.grad : '#C6F135',
            color: '#fff', textDecoration: 'none',
            padding: '15px 32px', borderRadius: 13,
            fontWeight: 700, fontSize: 15,
            boxShadow: isPromo && RC ? `0 6px 24px ${RC.glow}` : undefined,
            animation: 'fadeUp 0.4s 0.45s both',
          }}>
            Перейти к кошельку
          </Link>
          <Link to="/" style={{
            display: 'block', marginTop: 18,
            color: C.t3, fontSize: 14,
            textDecoration: 'none', animation: 'fadeUp 0.4s 0.55s both',
          }}>
            Вернуться на главную
          </Link>
        </>
      )}

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
            {errInfo.title}
          </div>
          <div style={{ color: C.t3, fontSize: 15, lineHeight: 1.6, marginBottom: 36, maxWidth: 280 }}>
            {errInfo.text}
          </div>
          <Link to="/" style={{
            background: C.surf, border: `1px solid ${C.b2}`,
            color: C.purpleL, textDecoration: 'none',
            padding: '14px 36px', borderRadius: 16,
            fontWeight: 700, fontSize: 16,
          }}>
            На главную
          </Link>
        </>
      )}
    </div>
  );
}
