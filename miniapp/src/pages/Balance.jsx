import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';

export default function Balance() {
  const [user, setUser] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [meResponse, visitsResponse] = await Promise.all([
          fetch(`${API_BASE}/api/me`, { headers: { initdata: initData } }),
          fetch(`${API_BASE}/api/visits`, { headers: { initdata: initData } }),
        ]);

        if (!meResponse.ok || !visitsResponse.ok) {
          throw new Error('Ошибка загрузки данных');
        }

        const meData = await meResponse.json();
        const visitsData = await visitsResponse.json();

        setUser(meData.user);
        setVisits(visitsData.visits || []);
      } catch (fetchError) {
        console.error(fetchError);
        setError('Не удалось загрузить информацию.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return <p style={{ padding: 20 }}>Загрузка...</p>;
  }

  if (error) {
    return <p style={{ padding: 20, color: 'red' }}>{error}</p>;
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 16 }}>Баланс</h1>
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
          marginBottom: 24,
        }}
      >
        <p style={{ margin: 0, color: '#555' }}>Текущий баланс</p>
        <p style={{ margin: '12px 0 0', fontSize: 36, fontWeight: 700 }}>{user?.balance ?? 0} сум</p>
      </div>

      <h2 style={{ marginBottom: 12 }}>Последние чекины</h2>
      {visits.length === 0 && <p>Пока нет посещений.</p>}
      <div style={{ display: 'grid', gap: 12 }}>
        {visits.map((visit) => (
          <div
            key={visit.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: 14,
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <strong>{visit.business_name}</strong>
              <span>{visit.rewarded} сум</span>
            </div>
            <div style={{ color: '#777', fontSize: 14 }}>{new Date(visit.created_at).toLocaleString('ru-RU')}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <Link
          to="/withdraw"
          style={{ display: 'inline-block', padding: '12px 18px', background: '#1a73e8', color: '#fff', borderRadius: 10, textDecoration: 'none' }}
        >
          Вывести
        </Link>
      </div>
    </div>
  );
}
