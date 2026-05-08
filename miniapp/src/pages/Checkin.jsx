import { useEffect, useMemo, useState } from 'react';
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
  TOO_FAR:             { icon: '📍', title: 'Слишком далеко', text: 'Подойдите ближе к заведению и попробуйте снова.' },
  TOO_SOON:            { icon: '⏰', title: 'Уже чекинились', text: 'Вы недавно были в этом заведении. Возвращайтесь завтра!' },
  NO_ACTIVE_CAMPAIGN:  { icon: '📋', title: 'Нет акции',      text: 'В данный момент нет активных акций для этого заведения.' },
  INVALID_QR_TOKEN:    { icon: '🔗', title: 'Неверный QR',    text: 'QR-код недействителен. Попробуйте отсканировать заново.' },
};

export default function Checkin() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const { lat, lng, error: locError, loading: locLoading } = useLocation();
  const [status, setStatus] = useState('loading');
  const [reward, setReward] = useState(null);
  const [errInfo, setErrInfo] = useState(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (sent || locLoading) return;

    if (!token) {
      setStatus('error');
      setErrInfo({ icon: '🔗', title: 'Нет токена', text: 'Откройте приложение через Telegram-бота или QR-код.' });
      return;
    }
    if (locError) {
      setStatus('error');
      setErrInfo({ icon: '📍', title: 'Нет геолокации', text: locError });
      return;
    }
    if (lat == null || lng == null) return;

    setSent(true);

    fetch(`${API_BASE}/api/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', initdata: initData },
      body: JSON.stringify({ qrToken: token, lat, lng }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, data: d })))
      .then(({ ok, data }) => {
        if (!ok) {
          const code = data?.error || 'UNKNOWN';
          setErrInfo(ERRORS[code] || { icon: '❌', title: 'Ошибка', text: 'Не удалось выполнить чекин. Попробуйте позже.' });
          setStatus('error');
        } else {
          setReward(data.reward);
          setStatus('success');
        }
      })
      .catch(() => {
        setErrInfo({ icon: '🌐', title: 'Нет соединения', text: 'Проверьте интернет и попробуйте снова.' });
        setStatus('error');
      });
  }, [token, lat, lng, locError, locLoading, sent]);

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

      {/* LOADING */}
      {status === 'loading' && (
        <>
          <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 28 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(42,171,238,0.15)',
              animation: 'ripple 1.6s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(42,171,238,0.1)',
              animation: 'ripple 1.6s ease-out 0.5s infinite',
            }} />
            <div style={{
              position: 'relative', zIndex: 1,
              width: 96, height: 96, borderRadius: '50%',
              background: '#fff', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(42,171,238,0.2)',
              fontSize: 38,
            }}>
              📍
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10 }}>Выполняется чекин</div>
          <div style={{ color: '#8E8E93', fontSize: 15, lineHeight: 1.5 }}>
            {locLoading
              ? 'Определяем ваше местоположение...'
              : 'Проверяем расстояние до заведения...'}
          </div>
        </>
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
            background: '#fff',
            borderRadius: 20, padding: '20px 36px',
            marginBottom: 28,
            boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
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

          <Link to="/" style={{
            marginTop: 14, color: '#8E8E93', fontSize: 14,
            textDecoration: 'none', animation: 'fadeUp 0.4s 0.5s both',
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
            background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 52, marginBottom: 24,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            animation: 'pop 0.45s cubic-bezier(0.175,0.885,0.32,1.275)',
          }}>
            {errInfo.icon}
          </div>

          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10 }}>
            {errInfo.title}
          </div>
          <div style={{
            color: '#8E8E93', fontSize: 15, lineHeight: 1.6,
            marginBottom: 32, maxWidth: 280,
          }}>
            {errInfo.text}
          </div>

          <Link to="/" style={{
            background: '#fff', color: '#2AABEE',
            textDecoration: 'none',
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
