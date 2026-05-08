import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';

export default function Home() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCampaigns() {
      try {
        const response = await fetch(`${API_BASE}/api/campaigns`, {
          headers: {
            initdata: initData,
          },
        });

        if (!response.ok) {
          throw new Error('Ошибка загрузки кампаний');
        }

        const data = await response.json();
        setCampaigns(data || []);
      } catch (fetchError) {
        setError('Не удалось загрузить предложения.');
        console.error(fetchError);
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 16 }}>GeoEarn</h1>
      <p style={{ marginBottom: 20 }}>Выбирайте заведение и получайте вознаграждение за чекин.</p>

      {loading && <p>Загрузка...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && campaigns.length === 0 && <p>Нет активных кампаний.</p>}

      <div style={{ display: 'grid', gap: 16 }}>
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 12,
              padding: 16,
              background: '#fff',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>{campaign.business_name}</h2>
            <p style={{ margin: '8px 0', color: '#555' }}>{campaign.address}</p>
            <p style={{ margin: 0, fontWeight: 700 }}>{campaign.reward_amount} сум</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <Link to="/balance" style={{ color: '#1a73e8', textDecoration: 'none' }}>
          Перейти к балансу
        </Link>
      </div>
    </div>
  );
}
