import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';

export default function Withdraw() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadBalance() {
      try {
        const response = await fetch(`${API_BASE}/api/me`, {
          headers: {
            initdata: initData,
          },
        });

        if (!response.ok) {
          throw new Error('Ошибка загрузки баланса');
        }

        const data = await response.json();
        setBalance(data.user?.balance || 0);
      } catch (fetchError) {
        console.error(fetchError);
        setError('Не удалось получить баланс.');
      } finally {
        setLoading(false);
      }
    }

    loadBalance();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const amountValue = Number(amount.replace(/\s+/g, '').replace(',', '.'));

    if (!phone.trim()) {
      setError('Введите номер телефона Payme.');
      return;
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Введите корректную сумму.');
      return;
    }

    if (amountValue > balance) {
      setError('Сумма не должна превышать текущий баланс.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          initdata: initData,
        },
        body: JSON.stringify({ phone, amount: amountValue }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Не удалось отправить заявку.');
        return;
      }

      setMessage('Заявка принята, перевод в течение 24 часов.');
      setBalance(balance - amountValue);
      setPhone('');
      setAmount('');
    } catch (submitError) {
      console.error(submitError);
      setError('Ошибка при отправке заявки. Попробуйте позже.');
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 16 }}>Вывод</h1>
      {loading && <p>Загрузка...</p>}
      {!loading && (
        <div>
          <p style={{ marginBottom: 24 }}>Текущий баланс: <strong>{balance} сум</strong></p>
          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', marginBottom: 12 }}>
              Номер телефона Payme
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="998901234567"
                style={{ width: '100%', padding: 10, marginTop: 8, borderRadius: 10, border: '1px solid #ccc' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              Сумма
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                style={{ width: '100%', padding: 10, marginTop: 8, borderRadius: 10, border: '1px solid #ccc' }}
              />
            </label>
            {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}
            {message && <p style={{ color: 'green', marginBottom: 12 }}>{message}</p>}
            <button
              type="submit"
              style={{
                background: '#1a73e8',
                color: '#fff',
                border: 'none',
                padding: '12px 18px',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Отправить заявку
            </button>
            <button
              type="button"
              onClick={() => navigate('/balance')}
              style={{
                marginLeft: 12,
                background: '#f1f3f4',
                color: '#202124',
                border: 'none',
                padding: '12px 18px',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Назад
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
