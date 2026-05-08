import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { useLocation } from '../hooks/useLocation';
import { API_BASE } from '../lib/api';
import { formatGeo } from '../lib/geo';

const ANIM = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes ripple {
    0%   { transform: scale(0.8); opacity: 1; }
    100% { transform: scale(2.4); opacity: 0; }
  }
  @keyframes pop {
    0%   { transform: scale(0); opacity: 0; }
    65%  { transform: scale(1.18); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes fadeUp {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
  }
  @keyframes coinBurst {
    0%   { transform: translate(0,0) scale(1.2); opacity: 1; }
    80%  { opacity: 0.7; }
    100% { transform: translate(var(--tx),var(--ty)) scale(0.1); opacity: 0; }
  }
  @keyframes glow {
    0%,100% { box-shadow: 0 8px 32px rgba(52,199,89,0.4); }
    50%      { box-shadow: 0 8px 48px rgba(52,199,89,0.7); }
  }
  @keyframes countUp {
    from { transform: translateY(12px); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
  }
`;

const BURST = [
  { tx: '-72px', ty: '-80px', delay: '0s',    emoji: '💎' },
  { tx:   '0px', ty: '-96px', delay: '0.06s', emoji: '⭐' },
  { tx:  '72px', ty: '-80px', delay: '0.04s', emoji: '💎' },
  { tx:  '96px', ty:   '0px', delay: '0.08s', emoji: '⭐' },
  { tx:  '72px', ty:  '80px', delay: '0.06s', emoji: '💎' },
  { tx:   '0px', ty:  '96px', delay: '0.1s',  emoji: '⭐' },
  { tx: '-72px', ty:  '80px', delay: '0.04s', emoji: '💎' },
  { tx: '-96px', ty:   '0px', delay: '0.02s', emoji: '⭐' },
];

const ERRORS = {
  TOO_FAR:            { icon: '📍', title: 'Слишком далеко',       text: 'Подойдите ближе к заведению и попробуйте снова.' },
  TOO_SOON:           { icon: '⏰', title: 'Уже чекинились',      text: 'Вы недавно были в этом заведении. Возвращайтесь завтра!' },
  NO_ACTIVE_CAMPAIGN: { icon: '📋', title: 'Нет акции',            text: 'В данный момент нет активных акций для этого заведения.' },
  INVALID_QR_TOKEN:   { icon: '🔗', title: 'Неверный QR',          text: 'QR-код недействителен. Попробуйте отсканировать заново.' },
  PIN_REQUIRED:       { icon: '🔐', title: 'Нужен PIN',             text: 'Для этого заведения требуется PIN-код от сотрудника.' },
  INVALID_PIN:        { icon: '🔑', title: 'Неверный PIN',          text: 'Введённый PIN-код неверен. Попросите сотрудника повторить.' },
  PIN_USED:           { icon: '🚫', title: 'PIN уже использован',  text: 'Этот PIN уже использован. Попросите новый.' },
  PIN_EXPIRED:        { icon: '⌛', title: 'PIN устарел',           text: 'Срок действия PIN истёк. Попросите сотрудника сгенерировать новый.' },
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

  // Step 1: fetch business info
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrInfo({ icon: '🔗', title: 'Нет токена', text: 'Откройте приложение через Telegram-бота или QR-код.' });
      return;
    }
    fetch(`${API_BASE}/api/checkin/info?token=${encodeURIComponent(token)}`)
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) {
          const code = data?.error || 'UNKNOWN';
          setErrInfo(ERRORS[code] || { icon: '❌', title: 'Ошибка', text: 'Не удалось найти заведение.' });
          setStatus('error');
        } else {
          setBusinessInfo(data);
        }
      })
      .catch(() => {
        setErrInfo({ icon: '🌐', title: 'Нет соединения', text: 'Проверьте интернет и попробуйте снова.' });
        setStatus('error');
      });
  }, [token]);

  // Step 2: once location + business info ready
  useEffect(() => {
    if (!businessInfo || sent.current || status === 'error') return;
    if (locError) {
      setStatus('error');
      setErrInfo({ icon: '📍', title: 'Нет геолокации', text: locError });
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
          setErrInfo(ERRORS[code] || { icon: '❌', title: 'Ошибка', text: 'Не удалось выполнить чекин.' });
          setStatus('error');
        }
      } else {
        setReward(data.reward);
        setStatus('success');
        setShowBurst(true);
        setTimeout(() => setShowBurst(false), 1200);
      }
    } catch {
      setErrInfo({ icon: '🌐', title: 'Нет соединения', text: 'Проверьте интернет и попробуйте снова.' });
      setStatus('error');
    }
  }

  function handlePinSubmit(e) {
    e.preventDefault();
    if (pin.length < 4) { setPinError('Введите PIN (4–6 цифр)'); return; }
    setPinError('');
    doCheckin(pin);
  }

  const isDark = status === 'success';
  const pageBg = isDark
    ? 'linear-gradient(160deg, #0A0F1A 0%, #0D1F12 50%, #0A0F1A 100%)'
    : '#EFEFF4';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px',
      background: pageBg,
      textAlign: 'center',
      transition: 'background 0.5s ease',
    }}>
      <style>{ANIM}</style>

      {/* COIN BURST OVERLAY */}
      {showBurst && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {BURST.map((c, i) => (
            <div key={i} style={{
              position: 'absolute', fontSize: 28,
              '--tx': c.tx, '--ty': c.ty,
              animation: `coinBurst 1.0s ${c.delay} cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
            }}>
              {c.emoji}
            </div>
          ))}
        </div>
      )}

      {/* LOADING / SUBMITTING */}
      {(status === 'loading' || status === 'submitting') && (
        <>
          <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 28 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(42,171,238,0.15)', animation: 'ripple 1.6s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(42,171,238,0.1)', animation: 'ripple 1.6s ease-out 0.5s infinite' }} />
            <div style={{
              position: 'relative', zIndex: 1, width: 96, height: 96, borderRadius: '50%',
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(42,171,238,0.2)', fontSize: 38,
            }}>
              {status === 'submitting' ? '✔️' : '📍'}
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10, color: '#1C1C1E' }}>
            {status === 'submitting' ? 'Отправляем чекин…' : 'Выполняется чекин'}
          </div>
          <div style={{ color: '#8E8E93', fontSize: 15, lineHeight: 1.5 }}>
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
        <div style={{ width: '100%', maxWidth: 360, animation: 'fadeUp 0.4s ease' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF9500, #e08000)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, margin: '0 auto 24px',
            boxShadow: '0 4px 20px rgba(255,149,0,0.35)',
          }}>🔐</div>

          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 6, color: '#1C1C1E' }}>
            Введите PIN-код
          </div>
          <div style={{ color: '#8E8E93', fontSize: 15, marginBottom: 8 }}>{businessInfo.businessName}</div>
          <div style={{ color: '#8E8E93', fontSize: 14, marginBottom: 28, lineHeight: 1.4 }}>
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
                border: `2px solid ${pinError ? '#FF3B30' : pin.length >= 4 ? '#34C759' : 'rgba(0,0,0,0.12)'}`,
                fontSize: 28, fontWeight: 700, textAlign: 'center',
                letterSpacing: 8, outline: 'none', background: '#fff',
                transition: 'border-color 0.15s', marginBottom: 12,
              }}
            />
            {pinError && (
              <div style={{
                background: 'rgba(255,59,48,0.08)', color: '#FF3B30',
                borderRadius: 10, padding: '10px 12px', fontSize: 14,
                fontWeight: 500, marginBottom: 16, border: '1px solid rgba(255,59,48,0.15)',
              }}>
                ⚠️ {pinError}
              </div>
            )}
            <button type="submit" disabled={pin.length < 4} style={{
              width: '100%',
              background: pin.length >= 4 ? 'linear-gradient(135deg, #2AABEE, #1a8fcc)' : '#C7C7CC',
              color: '#fff', border: 'none', padding: '16px', borderRadius: 14,
              fontWeight: 700, fontSize: 16,
              cursor: pin.length >= 4 ? 'pointer' : 'not-allowed',
              boxShadow: pin.length >= 4 ? '0 4px 16px rgba(42,171,238,0.35)' : 'none',
              transition: 'all 0.2s',
            }}>
              Подтвердить
            </button>
          </form>

          {businessInfo.reward > 0 && (
            <div style={{ marginTop: 20, color: '#8E8E93', fontSize: 13 }}>
              Вознаграждение: <strong style={{ color: '#34C759' }}>+{formatGeo(businessInfo.reward)} GEO</strong>
            </div>
          )}
        </div>
      )}

      {/* SUCCESS */}
      {status === 'success' && (
        <>
          {/* Icon with glow */}
          <div style={{
            width: 112, height: 112, borderRadius: '50%',
            background: 'linear-gradient(135deg, #34C759, #1fa83c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 54, marginBottom: 28,
            animation: 'pop 0.55s cubic-bezier(0.175,0.885,0.32,1.275), glow 2s 0.6s ease-in-out infinite',
          }}>
            ✅
          </div>

          <div style={{ fontWeight: 900, fontSize: 26, marginBottom: 6, color: '#fff', animation: 'fadeUp 0.4s 0.2s both' }}>
            Чекин выполнен!
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 28, animation: 'fadeUp 0.4s 0.25s both' }}>
            GEO-монеты зачислены на ваш кошелёк
          </div>

          {/* Reward card */}
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1.5px solid rgba(52,199,89,0.3)',
            backdropFilter: 'blur(12px)',
            borderRadius: 24, padding: '24px 40px',
            marginBottom: 32,
            animation: 'fadeUp 0.4s 0.3s both',
          }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Вы получили
            </div>
            <div style={{ animation: 'countUp 0.5s 0.45s both' }}>
              <div style={{ fontSize: 52, fontWeight: 900, color: '#34C759', letterSpacing: -2, lineHeight: 1 }}>
                +{formatGeo(reward)}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(52,199,89,0.8)', marginTop: 4 }}>
                GEO
              </div>
            </div>
          </div>

          <Link to="/balance" style={{
            display: 'block', width: '100%', maxWidth: 300,
            background: 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
            color: '#fff', textDecoration: 'none',
            padding: '16px 32px', borderRadius: 16,
            fontWeight: 800, fontSize: 16,
            boxShadow: '0 4px 20px rgba(42,171,238,0.4)',
            animation: 'fadeUp 0.4s 0.45s both',
          }}>
            Перейти к балансу →
          </Link>
          <Link to="/" style={{
            display: 'block', marginTop: 16,
            color: 'rgba(255,255,255,0.4)', fontSize: 14,
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
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 52, marginBottom: 24,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            animation: 'pop 0.45s cubic-bezier(0.175,0.885,0.32,1.275)',
          }}>
            {errInfo.icon}
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10, color: '#1C1C1E' }}>
            {errInfo.title}
          </div>
          <div style={{ color: '#8E8E93', fontSize: 15, lineHeight: 1.6, marginBottom: 32, maxWidth: 280 }}>
            {errInfo.text}
          </div>
          <Link to="/" style={{
            background: '#fff', color: '#2AABEE', textDecoration: 'none',
            padding: '14px 32px', borderRadius: 14,
            fontWeight: 700, fontSize: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
          }}>
            На главную
          </Link>
        </>
      )}
    </div>
  );
}
