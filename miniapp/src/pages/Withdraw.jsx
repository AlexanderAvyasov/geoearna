import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';

const ANIM = `
  @keyframes fadeUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes pop { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
`;

function Input({ label, value, onChange, placeholder, type = 'text', inputMode }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#8E8E93',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
      }}>
        {label}
      </div>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '14px 16px',
          borderRadius: 12,
          border: `1.5px solid ${focused ? '#2AABEE' : 'rgba(0,0,0,0.1)'}`,
          fontSize: 16, outline: 'none',
          background: '#fff', boxSizing: 'border-box',
          color: '#1C1C1E',
          transition: 'border-color 0.15s',
        }}
      />
    </div>
  );
}

export default function Withdraw() {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/api/me`, { headers: { initdata: initData } })
      .then(r => r.json())
      .then(d => setBalance(d.user?.balance || 0))
      .catch(() => setError('Не удалось загрузить баланс.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const val = Number(amount.replace(/\s+/g, '').replace(',', '.'));
    if (!phone.trim()) return setError('Введите номер телефона Payme.');
    if (!Number.isFinite(val) || val <= 0) return setError('Введите корректную сумму.');
    if (val > balance) return setError(`Максимальная сумма: ${balance.toLocaleString()} сум.`);

    setSubmitting(true);
    try {
      const r = await fetch(`${API_BASE}/api/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', initdata: initData },
        body: JSON.stringify({ phone, amount: val }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error === 'INSUFFICIENT_FUNDS'
          ? 'Недостаточно средств на балансе.'
          : 'Не удалось создать заявку. Попробуйте позже.');
        return;
      }
      setBalance(data.totalBalance);
      setSuccess(true);
    } catch {
      setError('Ошибка соединения. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#EFEFF4' }}>
      <style>{ANIM}</style>

      {/* Header */}
      <div style={{
        background: '#fff',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => navigate('/balance')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#2AABEE', fontSize: 22, padding: '4px 8px 4px 0',
          display: 'flex', alignItems: 'center',
        }}>
          ←
        </button>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Вывод средств</div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Balance card */}
        {!loading && (
          <div style={{
            background: 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
            borderRadius: 18, padding: '20px',
            color: '#fff', marginBottom: 20,
            boxShadow: '0 4px 16px rgba(42,171,238,0.3)',
            animation: 'fadeUp 0.3s ease',
          }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Доступно для вывода
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1 }}>
              {balance.toLocaleString()}
              <span style={{ fontSize: 18, fontWeight: 500, opacity: 0.85, marginLeft: 8 }}>сум</span>
            </div>
          </div>
        )}

        {/* Success */}
        {success ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', animation: 'fadeUp 0.4s ease' }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: 'linear-gradient(135deg, #34C759, #25a244)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 46, margin: '0 auto 20px',
              boxShadow: '0 6px 24px rgba(52,199,89,0.4)',
              animation: 'pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)',
            }}>
              ✅
            </div>
            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Заявка принята!</div>
            <div style={{ color: '#8E8E93', fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
              Перевод на Payme в течение 24 часов.<br />
              Остаток: <strong>{balance.toLocaleString()} сум</strong>
            </div>
            <button onClick={() => navigate('/balance')} style={{
              background: 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
              color: '#fff', border: 'none',
              padding: '15px 36px', borderRadius: 14,
              fontWeight: 700, fontSize: 16, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(42,171,238,0.35)',
            }}>
              К балансу
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} style={{ animation: 'fadeUp 0.3s 0.1s both' }}>
            <div style={{
              background: '#fff', borderRadius: 16,
              padding: '20px 16px', marginBottom: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <Input
                label="Номер Payme"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="998 90 123 45 67"
                type="tel"
              />
              <Input
                label="Сумма (сум)"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={balance > 0 ? `До ${balance.toLocaleString()}` : '0'}
                inputMode="numeric"
              />

              {/* Quick amounts */}
              {balance > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 8 }}>Быстрый выбор</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[1000, 5000, 10000, balance].filter((v, i, a) => v <= balance && a.indexOf(v) === i).map(v => (
                      <button key={v} type="button" onClick={() => setAmount(String(v))} style={{
                        padding: '6px 12px', borderRadius: 8,
                        border: amount === String(v) ? '1.5px solid #2AABEE' : '1.5px solid rgba(0,0,0,0.1)',
                        background: amount === String(v) ? 'rgba(42,171,238,0.08)' : '#fff',
                        color: amount === String(v) ? '#2AABEE' : '#3C3C3E',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}>
                        {v === balance ? 'Всё' : `${v.toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,59,48,0.08)', color: '#FF3B30',
                borderRadius: 12, padding: '12px 14px',
                fontSize: 14, fontWeight: 500, marginBottom: 16,
                border: '1px solid rgba(255,59,48,0.15)',
              }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={submitting || loading} style={{
              width: '100%',
              background: (submitting || loading) ? '#C7C7CC' : 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
              color: '#fff', border: 'none',
              padding: '16px', borderRadius: 14,
              fontWeight: 700, fontSize: 16,
              cursor: (submitting || loading) ? 'not-allowed' : 'pointer',
              boxShadow: (submitting || loading) ? 'none' : '0 4px 16px rgba(42,171,238,0.35)',
              transition: 'all 0.2s',
            }}>
              {submitting ? '⏳ Отправляем...' : 'Отправить заявку'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#8E8E93' }}>
              Средства поступят на ваш счёт Payme в течение 24 часов
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
