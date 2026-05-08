import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { geoToUzs, formatGeo, formatUzs, isValidUzPhone, normalizePhone } from '../lib/geo';
import { C, G, E, cardBase, inputStyle } from '../lib/design';

function Field({ label, value, onChange, placeholder, type = 'text', inputMode, hint }) {
  const [focused, setFocused] = useState(false);
  const [hasError] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
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
        style={inputStyle(focused, hasError)}
      />
      {hint && (
        <div style={{ fontSize: 12, color: C.t3, marginTop: 6, paddingLeft: 2 }}>{hint}</div>
      )}
    </div>
  );
}

export default function Withdraw() {
  const [phone,     setPhone]     = useState('');
  const [amount,    setAmount]    = useState('');
  const [balance,   setBalance]   = useState(0);
  const [geoRate,   setGeoRate]   = useState(1);
  const [success,   setSuccess]   = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(true);
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

  const geoVal    = Number(amount.replace(/\s+/g, '').replace(',', '.')) || 0;
  const uzsPreview = geoToUzs(geoVal, geoRate);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!phone.trim())           return setError('Введите номер телефона Payme.');
    if (!isValidUzPhone(phone))  return setError('Формат: +998901234567');
    if (!Number.isFinite(geoVal) || geoVal <= 0) return setError('Введите корректную сумму.');
    if (geoVal > balance)        return setError(`Максимум: ${formatGeo(balance)} GEO`);

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
    <div style={{ minHeight: '100vh', background: C.bg, animation: 'pageEnter 0.4s ease both' }}>
      {/* Header */}
      <div style={{
        background: 'rgba(8,9,14,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `1px solid ${C.b1}`,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => navigate('/balance')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.blue, fontSize: 22, padding: '4px 8px 4px 0',
          display: 'flex', alignItems: 'center',
        }}>←</button>
        <div style={{ fontWeight: 700, fontSize: 18, color: C.t1 }}>Вывод GEO → UZS</div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Balance card */}
        {!loading && (
          <div style={{
            background: G.hero,
            borderRadius: 20, padding: '22px',
            color: C.t1, marginBottom: 20,
            border: `1px solid ${C.b1}`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
            animation: 'fadeUp 0.35s ease both',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -30, right: -30,
              width: 130, height: 130, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(42,171,238,0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              💎 Доступно
            </div>
            <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.5 }}>
              {formatGeo(balance)}
              <span style={{ fontSize: 18, fontWeight: 500, color: C.t3, marginLeft: 8 }}>GEO</span>
            </div>
            <div style={{ fontSize: 15, color: C.t3, marginTop: 4 }}>
              ≈ {formatUzs(geoToUzs(balance, geoRate))} UZS
            </div>
          </div>
        )}

        {/* Success state */}
        {success ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', animation: 'fadeUp 0.4s ease both' }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: G.geo,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 46, margin: '0 auto 24px',
              boxShadow: `0 8px 32px ${C.geoGl}`,
              animation: 'pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)',
            }}>✅</div>

            <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 8, color: C.t1 }}>Заявка принята!</div>

            <div style={{
              ...cardBase,
              border: `1px solid ${C.b1}`,
              padding: '18px 24px', marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, color: C.t3, marginBottom: 4 }}>Спишется</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: C.t1, marginBottom: 2 }}>
                {formatGeo(geoVal)} GEO
              </div>
              <div style={{ fontSize: 14, color: C.t3 }}>
                = {formatUzs(successData?.uzsAmount || uzsPreview)} UZS → Payme
              </div>
            </div>

            <div style={{ color: C.t3, fontSize: 15, marginBottom: 36, lineHeight: 1.6 }}>
              Перевод на Payme в течение 24 часов.<br />
              Остаток: <strong style={{ color: C.t1 }}>{formatGeo(balance)} GEO</strong>
            </div>

            <button onClick={() => navigate('/balance')} style={{
              background: G.blue,
              color: '#fff', border: 'none',
              padding: '15px 40px', borderRadius: 16,
              fontWeight: 700, fontSize: 16, cursor: 'pointer',
              boxShadow: `0 6px 24px ${C.blueGl}`,
            }}>
              К кошельку
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ animation: 'fadeUp 0.35s 0.1s both' }}>
            <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '20px 16px', marginBottom: 16 }}>
              <Field
                label="Номер Payme"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                type="tel"
                hint="Формат: +998XXXXXXXXX"
              />
              <Field
                label="Сумма (GEO)"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={balance > 0 ? `До ${formatGeo(balance)}` : '0'}
                inputMode="numeric"
              />

              {/* UZS preview */}
              {geoVal > 0 && (
                <div style={{
                  background: C.blueFt, border: `1.5px solid ${C.blueGl}`,
                  borderRadius: 12, padding: '12px 14px', marginBottom: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 14, color: C.t3 }}>Получите на Payme</span>
                  <span style={{ fontWeight: 800, color: C.blue, fontSize: 16 }}>
                    {formatUzs(uzsPreview)} UZS
                  </span>
                </div>
              )}

              {/* Quick amounts */}
              {balance > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Быстрый выбор</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[1000, 5000, 10000, balance]
                      .filter((v, i, a) => v <= balance && a.indexOf(v) === i)
                      .map(v => (
                        <button key={v} type="button" onClick={() => setAmount(String(v))} style={{
                          padding: '7px 13px', borderRadius: 10,
                          border: amount === String(v) ? `1.5px solid ${C.blue}` : `1.5px solid ${C.b2}`,
                          background: amount === String(v) ? C.blueFt : 'transparent',
                          color: amount === String(v) ? C.blue : C.t2,
                          fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          transition: 'all 0.15s',
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
                background: C.redFt, color: C.red,
                borderRadius: 12, padding: '12px 14px',
                fontSize: 14, fontWeight: 600, marginBottom: 16,
                border: `1px solid rgba(255,59,92,0.2)`,
              }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={submitting || loading} style={{
              width: '100%',
              background: (submitting || loading) ? C.b2 : G.blue,
              color: '#fff', border: 'none',
              padding: '17px', borderRadius: 16,
              fontWeight: 700, fontSize: 16,
              cursor: (submitting || loading) ? 'not-allowed' : 'pointer',
              boxShadow: (submitting || loading) ? 'none' : `0 6px 24px ${C.blueGl}`,
              transition: 'all 0.2s',
            }}>
              {submitting ? '⏳ Отправляем...' : 'Вывести GEO'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: C.t3 }}>
              Конвертация GEO → UZS по курсу 1 GEO = {geoRate} UZS
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
