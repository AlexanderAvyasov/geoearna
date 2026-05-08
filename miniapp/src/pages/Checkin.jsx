import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { useLocation } from '../hooks/useLocation';
import { API_BASE } from '../lib/api';

const ANIM = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes ripple {
    0%   { transform: scale(0.8); opacity: 1; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes pop {
    0%   { transform: scale(0); opacity: 0; }
    65%  { transform: scale(1.15); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes fadeUp {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0);   opacity: 1; }
  }
`;

const ERRORS = {
  TOO_FAR:             { icon: '📍', title: 'Слишком далеко',  text: 'Подойдите ближе к заведению и попробуйте снова.' },
  TOO_SOON:            { icon: '⏰', title: 'Уже чекинились', text: 'Вы недавно были в этом заведении. Возвращайтесь завтра!' },
  NO_ACTIVE_CAMPAIGN:  { icon: '📋', title: 'Нет акции',       text: 'В данный момент нет активных акций для этого заведения.' },
  INVALID_QR_TOKEN:    { icon: '🔗', title: 'Неверный QR',     text: 'QR-код недействителен. Попробуйте отсканировать заново.' },
  PIN_REQUIRED:        { icon: '🔐', title: 'Нужен PIN',        text: 'Для этого заведения требуется PIN-код от сотрудника.' },
  INVALID_PIN:         { icon: '🔑', title: 'Неверный PIN',     text: 'Введённый PIN-код неверен. Попросите сотрудника повторить.' },
  PIN_USED:            { icon: '🚫', title: 'PIN уже использован', text: 'Этот PIN уже использован. Попросите новый код у сотрудника.' },
  PIN_EXPIRED:         { icon: '⌛', title: 'PIN устарел',      text: 'Срок действия PIN истёк. Попросите сотрудника сгенерировать новый.' },
};

export default function Checkin() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const { lat, lng, error: locError, loading: locLoading } = useLocation();

  const [status, setStatus] = useState('loading'); // loading | pin | submitting | success | error
  const [reward, setReward] = useState(null);
  const [errInfo, setErrInfo] = useState(null);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const pinRef = useRef(null);

  const sent = useRef(false);

  // Step 1: fetch business info (no auth needed)
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
          // Stay in loading until we have location
        }
      })
      .catch(() => {
        setErrInfo({ icon: '🌐', title: 'Нет соединения', text: 'Проверьте интернет и попробуйте снова.' });
        setStatus('error');
      });
  }, [token]);

  // Step 2: once we have location + business info, decide next step
  useEffect(() => {
    if (!businessInfo || sent.current) return;
    if (status === 'error') return;

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
        if (code === 'PIN_REQUIRED' || code === 'INVALID_PIN' || code === 'PIN_USED' || code === 'PIN_EXPIRED') {
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
      }
    } catch {
      setErrInfo({ icon: '🌐', title: 'Нет соединения', text: 'Проверьте интернет и попробуйте снова.' });
      setStatus('error');
    }
  }

  function handlePinSubmit(e) {
    e.preventDefault();
    if (pin.length < 4) { setPinError('Введите PIN (4-6 цифр)'); return; }
    setPinError('');
    doCheckin(pin);
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px',
      background: '#EFEFF4',
      textAlign: 'center',
    }}>
      <style>{ANIM}</style>

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
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10 }}>
            {status === 'submitting' ? 'Отправляем чекин...' : 'Выполняется чекин'}
          </div>
          <div style={{ color: '#8E8E93', fontSize: 15, lineHeight: 1.5 }}>
            {status === 'submitting' ? 'Подождите секунду...' : locLoading ? 'Определяем ваше местоположение...' : 'Загружаем информацию о заведении...'}
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
          }}>
            🔐
          </div>

          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>
            Введите PIN-код
          </div>
          <div style={{ color: '#8E8E93', fontSize: 15, marginBottom: 8, lineHeight: 1.5 }}>
            {businessInfo.businessName}
          </div>
          <div style={{ color: '#8E8E93', fontSize: 14, marginBottom: 28, lineHeight: 1.4 }}>
            Попросите сотрудника назвать PIN-код и введите его ниже
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
                transition: 'border-color 0.15s',
                marginBottom: 12,
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

            <button
              type="submit"
              disabled={pin.length < 4}
              style={{
                width: '100%',
                background: pin.length >= 4
                  ? 'linear-gradient(135deg, #2AABEE, #1a8fcc)'
                  : '#C7C7CC',
                color: '#fff', border: 'none',
                padding: '16px', borderRadius: 14,
                fontWeight: 700, fontSize: 16,
                cursor: pin.length >= 4 ? 'pointer' : 'not-allowed',
                boxShadow: pin.length >= 4 ? '0 4px 16px rgba(42,171,238,0.35)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              Подтвердить
            </button>
          </form>

          <div style={{ marginTop: 20, color: '#8E8E93', fontSize: 13, lineHeight: 1.5 }}>
            Вознаграждение: <strong style={{ color: '#34C759' }}>+{businessInfo.reward?.toLocaleString()} сум</strong>
          </div>
        </div>
      )}

      {/* SUCCESS */}
      {status === 'success' && (
        <>
          <div style={{
            width: 104, height: 104, borderRadius: '50%',
            background: 'linear-gradient(135deg, #34C759, #25a244)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 50, marginBottom: 24,
            boxShadow: '0 8px 28px rgba(52,199,89,0.4)',
            animation: 'pop 0.55s cubic-bezier(0.175,0.885,0.32,1.275)',
          }}>
            ✅
          </div>
          <div style={{ fontWeight: 800, fontSize: 24, marginBottom: 8, animation: 'fadeUp 0.4s 0.2s both' }}>
            Чекин выполнен!
          </div>
          <div style={{
            background: '#fff', borderRadius: 20, padding: '20px 36px',
            marginBottom: 28, boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
            animation: 'fadeUp 0.4s 0.3s both',
          }}>
            <div style={{ color: '#8E8E93', fontSize: 13, marginBottom: 6 }}>Вы получили</div>
            <div style={{ fontSize: 40, fontWeight: 900, color: '#34C759', letterSpacing: -1 }}>
              +{reward?.toLocaleString()}
              <span style={{ fontSize: 20, fontWeight: 600, opacity: 0.8, marginLeft: 6 }}>сум</span>
            </div>
          </div>
          <Link to="/balance" style={{
            background: 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
            color: '#fff', textDecoration: 'none',
            padding: '15px 36px', borderRadius: 14,
            fontWeight: 700, fontSize: 16,
            boxShadow: '0 4px 16px rgba(42,171,238,0.4)',
            animation: 'fadeUp 0.4s 0.4s both',
          }}>
            Перейти к балансу →
          </Link>
          <Link to="/" style={{ marginTop: 14, color: '#8E8E93', fontSize: 14, textDecoration: 'none', animation: 'fadeUp 0.4s 0.5s both' }}>
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
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10 }}>{errInfo.title}</div>
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
