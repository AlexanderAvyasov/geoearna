import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { useLocation } from '../hooks/useLocation';
import { API_BASE } from '../lib/api';

const errorMessages = {
  TOO_FAR: 'Вы слишком далеко от места чекина. Перейдите поближе к заведению и попробуйте снова.',
  TOO_SOON: 'Вы уже недавно чекинились в этом заведении. Попробуйте позже.',
  NO_ACTIVE_CAMPAIGN: 'В данный момент нет активных кампаний для этого заведения.',
};

export default function Checkin() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const { lat, lng, error: locationError, loading: locationLoading } = useLocation();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Выполняется чекин...');
  const [reward, setReward] = useState(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    async function doCheckin() {
      if (sent) {
        return;
      }

      if (!token) {
        setStatus('error');
        setMessage('Токен заведения не найден. Откройте страницу из Telegram.');
        return;
      }

      if (locationLoading) {
        return;
      }

      if (locationError) {
        setStatus('error');
        setMessage(locationError);
        return;
      }

      if (lat == null || lng == null) {
        setStatus('error');
        setMessage('Не удалось получить координаты.');
        return;
      }

      setSent(true);

      try {
        const response = await fetch(`${API_BASE}/api/checkin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            initdata: initData,
          },
          body: JSON.stringify({ qrToken: token, lat, lng }),
        });

        const result = await response.json();

        if (!response.ok) {
          const errorCode = result?.error || 'UNKNOWN_ERROR';
          setStatus('error');
          setMessage(errorMessages[errorCode] || 'Произошла ошибка при чекине. Попробуйте позже.');
          return;
        }

        setStatus('success');
        setReward(result.reward);
        setMessage(`Вы успешно чекинились и получили ${result.reward} сум!`);
      } catch (err) {
        console.error(err);
        setStatus('error');
        setMessage('Не удалось выполнить чекин. Попробуйте снова.');
      }
    }

    doCheckin();
  }, [token, lat, lng, locationError, locationLoading, sent]);

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 16 }}>Чекин</h1>
      {status === 'loading' && <p>Проверка местоположения и отправка чекина...</p>}
      {status === 'error' && <p style={{ color: 'red' }}>{message}</p>}
      {status === 'success' && (
        <div>
          <p style={{ fontSize: 24, fontWeight: 700, margin: '16px 0' }}>{message}</p>
          <Link to="/balance" style={{ color: '#1a73e8', textDecoration: 'none' }}>
            Перейти к балансу
          </Link>
        </div>
      )}
      <div style={{ marginTop: 24 }}>
        <Link to="/" style={{ color: '#1a73e8', textDecoration: 'none' }}>
          Назад к списку кампаний
        </Link>
      </div>
    </div>
  );
}
