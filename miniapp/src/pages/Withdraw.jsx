import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { geoToUzs, formatGeo, formatUzs, isValidUzPhone, normalizePhone } from '../lib/geo';

const ANIM = `
  @keyframes fadeUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes pop { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
`;

function Input({ label, value, onChange, placeholder, type = 'text', inputMode, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
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
          color: '#1C1C1E', transition: 'border-color 0.15s',
        }}
      />
      {hint && (
        <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 5, paddingLeft: 4 }}>{hint}</div>
      )}
    </div>
  );
}

export default function Withdraw() {
  const [phone, setPhone]       = useState('');
  const [amount, setAmount]     = useState('');
  const [balance, setBalance]   = useState(0);
  const [geoRate, setGeoRate]   = useState(1);
  const [success, setSuccess]   = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const h = { initdata: initData };
    Promise.all([
      fetch(`${API_BASE}/api/me`, { headers: h }).then(r => r.json()),
      fetch(`${API_BASE}/api/config`).then(r => r.json()).catch(() => ({ geoRate: 1 })),
    ])
      .then(([me, cfg]) => {
        setBalance(me.user?.balance || 0);
        setGeoRate(cfg.geoRate || 1);
      })
      .catch(() => setError('Не удалось загрузить баланс.'))
      .finally(() => setLoading(false));
  }, []);

  const geoVal = Number(amount.replace(/\s+/g, '').replace(',', '.')) || 0;
  const uzsPreview = geoToUzs(geoVal, geoRate);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!phone.trim()) return setError('Введите номер телефона Payme.');
    if (!isValidUzPhone(phone)) return setError('Формат: +998901234567');
    if (!Number.isFinite(geoVal) || geoVal <= 0) return setError('Введите корректную сумму.');
    if (geoVal > balance) return setError(`Максимум: ${formatGeo(balance)} GEO`);

    setSubmitting(true);
    try {
      const r = await fetch(`${API_BASE}/api/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', initdata: initData },
        body: JSON.stringify({ phone: normalizePhone(phone), amount: geoVal }),
      });
      const data = await r.json();
      if (!r.ok) {
        const msgs = {
          INSUFFICIENT_FUNDS: 'Недостаточно GEO на балансе.',
          INVALID_PHONE: 'Неверный формат телефона. Пример: +998901234567',
        };
        setError(msgs[data.error] || 'Не удалось создать заявку. Попробуйте позже.');
        return;
      }
      setBalance(data.totalBalance);
      setSuccessData(data);
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
        background: '#fff', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => navigate('/balance')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#2AABEE', fontSize: 22, padding: '4px 8px 4px 0',
          display: 'flex', alignItems: 'center',
        }}>←</button>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Вывод GEO → UZS</div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Balance card */}
        {!loading && (
          <div style={{
            background: 'linear-gradient(135deg, #1C1C1E, #3C3C3E)',
            borderRadius: 18, padding: '20px',
            color: '#fff', marginBottom: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            animation: 'fadeUp 0.3s ease',
          }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              💎 Доступно
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1 }}>
              {formatGeo(balance)}
              <span style={{ fontSize: 18, fontWeight: 500, opacity: 0.7, marginLeft: 8 }}>GEO</span>
            </div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              ≈ {formatUzs(geoToUzs(balance, geoRate))} UZS
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
            }}>✅</div>

            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Заявка принята!</div>

            <div style={{
              background: '#fff', borderRadius: 16, padding: '16px 24px',
              marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: 13, color: '#8E8E93', marginBottom: 4 }}>Спишется</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#1C1C1E', marginBottom: 2 }}>
                {formatGeo(geoVal)} GEO
              </div>
              <div style={{ fontSize: 14, color: '#8E8E93' }}>
                = {formatUzs(successData?.uzsAmount || uzsPreview)} UZS → Payme
              </div>
            </div>

            <div style={{ color: '#8E8E93', fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
              Перевод на Payme в течение 24 часов.<br />
              Остаток: <strong>{formatGeo(balance)} GEO</strong>
            </div>

            <button onClick={() => navigate('/balance')} style={{
              background: 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
              color: '#fff', border: 'none',
              padding: '15px 36px', borderRadius: 14,
              fontWeight: 700, fontSize: 16, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(42,171,238,0.35)',
            }}>
              К кошельку
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ animation: 'fadeUp 0.3s 0.1s both' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '20px 16px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

              <Input
                label="Номер Payme"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                type="tel"
                hint="Формат: +998XXXXXXXXX"
              />

              <Input
                label="Сумма (GEO)"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={balance > 0 ? `До ${formatGeo(balance)}` : '0'}
                inputMode="numeric"
              />

              {/* UZS preview */}
              {geoVal > 0 && (
                <div style={{
                  background: 'rgba(42,171,238,0.07)',
                  border: '1.5px solid rgba(42,171,238,0.15)',
                  borderRadius: 10, padding: '10px 14px',
                  marginBottom: 16, fontSize: 14,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ color: '#8E8E93' }}>Получите на Payme</span>
                  <span style={{ fontWeight: 800, color: '#2AABEE', fontSize: 16 }}>
                    {formatUzs(uzsPreview)} UZS
                  </span>
                </div>
              )}

              {/* Quick amounts */}
              {balance > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginBottom: 8 }}>Быстрый выбор</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[1000, 5000, 10000, balance]
                      .filter((v, i, a) => v <= balance && a.indexOf(v) === i)
                      .map(v => (
                        <button key={v} type="button" onClick={() => setAmount(String(v))} style={{
                          padding: '6px 12px', borderRadius: 8,
                          border: amount === String(v) ? '1.5px solid #2AABEE' : '1.5px solid rgba(0,0,0,0.1)',
                          background: amount === String(v) ? 'rgba(42,171,238,0.08)' : '#fff',
                          color: amount === String(v) ? '#2AABEE' : '#3C3C3E',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}>
                          {v === balance ? 'Всё' : formatGeo(v)}
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
              {submitting ? '⏳ Отправляем...' : 'Вывести GEO'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#8E8E93' }}>
              Конвертация GEO → UZS по курсу 1 GEO = {geoRate} UZS
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
