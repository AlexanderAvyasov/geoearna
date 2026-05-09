import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { MapPin, Clock, ClipboardList, Link2, Lock, Key, Ban, Timer, XCircle, Wifi, CheckCircle, AlertTriangle } from 'lucide-react';
import { initData } from '../hooks/useTelegram';
import { useLocation } from '../hooks/useLocation';
import { API_BASE } from '../lib/api';
import { formatGeo } from '../lib/geo';
import { C, G, E } from '../lib/design';

const BURST_COLORS = [
  { tx: '-72px', ty: '-80px', delay: '0s',    color: C.purple   },
  { tx:   '0px', ty: '-96px', delay: '0.06s', color: C.purpleL  },
  { tx:  '72px', ty: '-80px', delay: '0.04s', color: C.indigo   },
  { tx:  '96px', ty:   '0px', delay: '0.08s', color: C.gold     },
  { tx:  '72px', ty:  '80px', delay: '0.06s', color: C.purple   },
  { tx:   '0px', ty:  '96px', delay: '0.1s',  color: C.emerald  },
  { tx: '-72px', ty:  '80px', delay: '0.04s', color: C.purpleL  },
  { tx: '-96px', ty:   '0px', delay: '0.02s', color: C.indigo   },
];

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

export default function Checkin() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const { lat, lng, error: locError, loading: locLoading } = useLocation();

  const [status,       setStatus]       = useState('loading');
  const [reward,       setReward]       = useState(null);
  const [errInfo,      setErrInfo]      = useState(null);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [pin,          setPin]          = useState('');
  const [pinError,     setPinError]     = useState('');
  const [showBurst,    setShowBurst]    = useState(false);
  const pinRef = useRef(null);
  const sent   = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrInfo({ Icon: Link2, title: 'Нет токена', text: 'Откройте приложение через Telegram-бота или QR-код.' });
      return;
    }
    fetch(`${API_BASE}/api/checkin/info?token=${encodeURIComponent(token)}`)
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) {
          const code = data?.error || 'UNKNOWN';
          setErrInfo(ERRORS[code] || { Icon: XCircle, title: 'Ошибка', text: 'Не удалось найти заведение.' });
          setStatus('error');
        } else {
          setBusinessInfo(data);
        }
      })
      .catch(() => {
        setErrInfo({ Icon: Wifi, title: 'Нет соединения', text: 'Проверьте интернет и попробуйте снова.' });
        setStatus('error');
      });
  }, [token]);

  useEffect(() => {
    if (!businessInfo || sent.current || status === 'error') return;
    if (locError) {
      setStatus('error');
      setErrInfo({ Icon: MapPin, title: 'Нет геолокации', text: locError });
      return;
    }
    if (locLoading || lat == null || lng == null) return;
    if (businessInfo.requiresPin) {
      setStatus('pin');
      setTimeout(() => pinRef.current?.focus(), 300);
    } else {
      doCheckin(null);
    }
  }, [businessInfo, locLoading, locError, lat, lng]);

  async function doCheckin(pinValue) {
    if (sent.current) return;
    sent.current = true;
    setStatus('submitting');
    try {
      const r = await fetch(`${API_BASE}/api/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', initdata: initData },
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

  function handlePinSubmit(e) {
    e.preventDefault();
    if (pin.length < 4) { setPinError('Введите PIN (4–6 цифр)'); return; }
    setPinError('');
    doCheckin(pin);
  }

  const isSuccess = status === 'success';

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
              position: 'absolute',
              width: 10, height: 10, borderRadius: '50%',
              background: c.color,
              boxShadow: `0 0 8px ${c.color}`,
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
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(198,241,53,0.08)',
              animation: 'ripple 1.6s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(198,241,53,0.04)',
              animation: 'ripple 1.6s ease-out 0.5s infinite',
            }} />
            <div style={{
              position: 'relative', zIndex: 1,
              width: 96, height: 96, borderRadius: '50%',
              background: C.surf, border: `0.5px solid rgba(198,241,53,0.18)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MapPin size={38} color="#C6F135" strokeWidth={1.75} />
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10, color: C.t1 }}>
            {status === 'submitting' ? 'Отправляем чекин…' : 'Выполняется чекин'}
          </div>
          <div style={{ color: C.t3, fontSize: 15, lineHeight: 1.5 }}>
            {status === 'submitting'
              ? 'Подождите секунду…'
              : locLoading
                ? 'Определяем ваше местоположение…'
                : 'Загружаем информацию о заведении…'}
          </div>
        </>
      )}

      {/* PIN INPUT */}
      {status === 'pin' && businessInfo && (
        <div style={{ width: '100%', maxWidth: 360, animation: 'fadeUp 0.4s ease both' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: G.gold,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: `0 6px 28px ${C.goldGl}`,
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
                background: C.surf,
                color: C.t1,
                fontSize: 28, fontWeight: 700, textAlign: 'center',
                letterSpacing: 10, outline: 'none',
                transition: 'border-color 0.15s', marginBottom: 12,
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
              border: `0.5px solid ${pin.length >= 4 ? 'transparent' : C.b2}`,
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
          <div style={{
            width: 116, height: 116, borderRadius: '50%',
            background: G.emerald,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 32,
            animation: 'pop 0.55s cubic-bezier(0.175,0.885,0.32,1.275), successGlow 2.5s 0.6s ease-in-out infinite',
          }}>
            <CheckCircle size={56} color="#fff" strokeWidth={2.5} />
          </div>

          <div style={{ fontWeight: 900, fontSize: 28, marginBottom: 6, color: C.t1, letterSpacing: -0.5, animation: 'fadeUp 0.4s 0.2s both' }}>
            Чекин выполнен!
          </div>
          <div style={{ color: C.t3, fontSize: 14, marginBottom: 32, animation: 'fadeUp 0.4s 0.25s both' }}>
            GEO‑монеты зачислены на ваш кошелёк
          </div>

          {/* Reward card */}
          <div style={{
            background: 'rgba(198,241,53,0.08)',
            border: `0.5px solid rgba(198,241,53,0.20)`,
            borderRadius: 24, padding: '26px 44px',
            marginBottom: 36,
            animation: 'fadeUp 0.4s 0.3s both',
          }}>
            <div style={{ color: C.t3, fontSize: 11, marginBottom: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Вы получили
            </div>
            <div style={{ animation: 'pop 0.5s 0.45s both' }}>
              <div style={{ fontSize: 56, fontWeight: 900, color: '#C6F135', letterSpacing: -2, lineHeight: 1, fontFamily: "'Syne', sans-serif" }}>
                +{formatGeo(reward)}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.t2, marginTop: 6 }}>GEO</div>
            </div>
          </div>

          <Link to="/balance" style={{
            display: 'block', width: '100%', maxWidth: 300,
            background: '#C6F135',
            color: '#090B10', textDecoration: 'none',
            padding: '15px 32px', borderRadius: 13,
            fontWeight: 700, fontSize: 15,
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
            marginBottom: 24,
            animation: 'pop 0.45s cubic-bezier(0.175,0.885,0.32,1.275)',
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
