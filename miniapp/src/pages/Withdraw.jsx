import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, CreditCard, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { geoToUzs, formatGeo, formatUzs, isValidCardNumber, normalizeCardNumber, formatCardNumber } from '../lib/geo';
import { C, E, cardBase, inputStyle } from '../lib/design';

const SYNE = { fontFamily: "'Syne', sans-serif" };

function Field({ label, value, onChange, placeholder, inputMode, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
        {label}
      </div>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={inputStyle(focused, false)}
      />
      {hint && (
        <div style={{ fontSize: 12, color: C.t3, marginTop: 6, paddingLeft: 2 }}>{hint}</div>
      )}
    </div>
  );
}

export default function Withdraw() {
  const [cardNumber, setCardNumber] = useState('');
  const [amount,     setAmount]     = useState('');
  const [balance,    setBalance]    = useState(0);
  const [geoRate,    setGeoRate]    = useState(1000);
  const [success,    setSuccess]    = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      apiFetch('/api/me').then(r => r.json()),
      apiFetch('/api/config').then(r => r.ok ? r.json() : { geoRate: 1000 }).catch(() => ({ geoRate: 1000 })),
    ])
      .then(([me, cfg]) => {
        setBalance(me.user?.balance || 0);
        setGeoRate(cfg.geoRate || 1000);
      })
      .catch(() => setError('Не удалось загрузить баланс.'))
      .finally(() => setLoading(false));
  }, []);

  const MIN_UZS    = 50_000;
  const geoVal     = Number(amount.replace(/\s+/g, '').replace(',', '.')) || 0;
  const uzsPreview = geoToUzs(geoVal, geoRate);
  const minGeo     = Math.ceil(MIN_UZS / geoRate);
  const belowMin   = geoVal > 0 && uzsPreview < MIN_UZS;
  const overMax    = geoVal > balance;
  const cardDigits = normalizeCardNumber(cardNumber);
  const cardValid  = isValidCardNumber(cardDigits);

  function handleCardInput(e) {
    setCardNumber(formatCardNumber(e.target.value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!cardValid) return setError('Введите корректный номер карты (16 цифр).');
    if (!Number.isFinite(geoVal) || geoVal <= 0) return setError('Введите корректную сумму.');
    if (belowMin) return setError(`Минимум вывода: ${formatUzs(MIN_UZS)} UZS (${formatGeo(minGeo)} GEO)`);
    if (geoVal > balance) return setError(`Максимум: ${formatGeo(balance)} GEO`);

    setSubmitting(true);
    try {
      const r = await apiFetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cardDigits, amount: geoVal }),
      });
      const data = await r.json();
      if (!r.ok) {
        const msgs = {
          INSUFFICIENT_FUNDS: 'Недостаточно GEO на балансе.',
          INVALID_CARD:       'Неверный номер карты. Введите 16 цифр.',
          BELOW_MINIMUM:      `Минимум вывода: ${formatUzs(MIN_UZS)} UZS (${formatGeo(data.minGeo || minGeo)} GEO)`,
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

  const disabled = submitting || loading || belowMin || overMax || !cardValid;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, animation: 'pageEnter 0.4s ease both' }}>
      {/* Header */}
      <div style={{
        background: C.bg,
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: `0.5px solid ${C.b1}`,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button onClick={() => navigate('/balance')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.t2, padding: '4px 8px 4px 0',
          display: 'flex', alignItems: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <ArrowLeft size={22} color={C.t2} strokeWidth={1.75} />
        </button>
        <div style={{ ...SYNE, fontWeight: 700, fontSize: 18, color: C.t1 }}>Вывод GEO</div>
      </div>

      <div style={{ padding: '16px 16px 32px' }}>
        {/* Balance card */}
        {!loading && (
          <div style={{
            ...cardBase,
            border: `0.5px solid ${C.b1}`,
            padding: '20px',
            marginBottom: 16,
            animation: 'fadeUp 0.35s ease both',
          }}>
            <div style={{ fontSize: 10, color: C.t3, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.2, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Wallet size={11} color={C.geo} strokeWidth={2} />
              Доступно
            </div>
            <div style={{ ...SYNE, fontSize: 38, fontWeight: 700, letterSpacing: -1.5, color: C.t1, lineHeight: 1 }}>
              {formatGeo(balance)}
              <span style={{ fontSize: 16, fontWeight: 500, color: C.t3, marginLeft: 8 }}>GEO</span>
            </div>
            <div style={{ fontSize: 14, color: C.t3, marginTop: 6 }}>
              ≈ {formatUzs(geoToUzs(balance, geoRate))} UZS
            </div>
          </div>
        )}

        {/* Success state */}
        {success ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', animation: 'fadeUp 0.4s ease both' }}>
            <div style={{
              width: 88, height: 88, borderRadius: '50%',
              background: C.geoDim,
              border: `0.5px solid ${C.geoGl}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
              animation: 'pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)',
            }}>
              <CheckCircle size={42} color={C.geo} strokeWidth={2} />
            </div>

            <div style={{ ...SYNE, fontWeight: 700, fontSize: 22, marginBottom: 8, color: C.t1 }}>Заявка принята!</div>

            <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '18px 24px', marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: C.t3, marginBottom: 4 }}>Спишется</div>
              <div style={{ ...SYNE, fontSize: 28, fontWeight: 700, color: C.t1, marginBottom: 2 }}>
                {formatGeo(geoVal)} GEO
              </div>
              <div style={{ fontSize: 14, color: C.t3 }}>
                = {formatUzs(successData?.uzsAmount || uzsPreview)} UZS → на карту
              </div>
            </div>

            <div style={{ color: C.t3, fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
              Перевод на карту в течение 24 часов.<br />
              Остаток: <strong style={{ color: C.t1 }}>{formatGeo(balance)} GEO</strong>
            </div>

            <button onClick={() => navigate('/balance')} style={{
              background: C.geo,
              color: C.bg, border: 'none',
              padding: '14px 40px', borderRadius: 13,
              fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}>
              К кошельку
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ animation: 'fadeUp 0.35s 0.1s both' }}>
            <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '20px 16px', marginBottom: 12 }}>
              {/* Card number */}
              <Field
                label="Номер карты (Humo / Uzcard)"
                value={cardNumber}
                onChange={handleCardInput}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                hint="16 цифр — Humo или Uzcard"
              />

              {/* Card type badge (show after 4+ digits) */}
              {cardDigits.length >= 4 && (
                <div style={{
                  display: 'flex', gap: 8, marginTop: -8, marginBottom: 14,
                }}>
                  {[
                    { label: 'Humo',   prefix: '9860' },
                    { label: 'Uzcard', prefix: '8600' },
                  ].map(({ label, prefix }) => {
                    const match = cardDigits.startsWith(prefix);
                    return (
                      <div key={label} style={{
                        padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: match ? C.geoDim : C.t4,
                        color: match ? C.geo : C.t3,
                        border: `0.5px solid ${match ? C.geoGl : C.b1}`,
                        transition: 'all 0.15s',
                      }}>
                        {label}
                      </div>
                    );
                  })}
                </div>
              )}

              <Field
                label="Сумма (GEO)"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={balance > 0 ? `До ${formatGeo(balance)}` : '0'}
                inputMode="numeric"
              />

              {/* Min info row */}
              <div style={{
                background: C.t4, border: `0.5px solid ${C.b1}`,
                borderRadius: 10, padding: '9px 12px', marginBottom: 14,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: C.t3 }}>Минимальная сумма</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.t2 }}>
                  {formatUzs(MIN_UZS)} UZS · {formatGeo(minGeo)} GEO
                </span>
              </div>

              {/* UZS preview */}
              {geoVal > 0 && (
                <div style={{
                  background: belowMin ? C.redFt : C.geoDim,
                  border: `0.5px solid ${belowMin ? 'rgba(248,113,113,0.25)' : C.geoGl}`,
                  borderRadius: 12, padding: '12px 14px', marginBottom: 14,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 14, color: C.t3 }}>Получите на карту</span>
                  <span style={{ fontWeight: 700, color: belowMin ? C.red : C.geo, fontSize: 16 }}>
                    {formatUzs(uzsPreview)} UZS
                  </span>
                </div>
              )}

              {/* Quick amounts */}
              {balance > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Быстрый выбор</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[1000, 5000, 10000, balance]
                      .filter((v, i, a) => v <= balance && a.indexOf(v) === i)
                      .map(v => {
                        const isSelected = amount === String(v);
                        return (
                          <button key={v} type="button" onClick={() => setAmount(String(v))} style={{
                            padding: '7px 13px', borderRadius: 10,
                            border: isSelected ? `0.5px solid ${C.geoGl}` : `0.5px solid ${C.b2}`,
                            background: isSelected ? C.geoDim : 'transparent',
                            color: isSelected ? C.geo : C.t2,
                            fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}>
                            {v === balance ? 'Всё' : formatGeo(v)}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div style={{
                background: C.redFt, color: C.red,
                borderRadius: 12, padding: '12px 14px',
                fontSize: 14, fontWeight: 600, marginBottom: 14,
                border: `0.5px solid rgba(248,113,113,0.20)`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={16} color={C.red} strokeWidth={2} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button type="submit" disabled={disabled} style={{
              width: '100%',
              background: disabled ? C.cardHi : C.geo,
              color: disabled ? C.t3 : C.bg,
              border: `0.5px solid ${disabled ? C.b2 : 'transparent'}`,
              padding: '15px', borderRadius: 13,
              fontWeight: 700, fontSize: 15,
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: `all 0.18s ${E.smooth}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {submitting
                ? <><Loader2 size={18} color={C.t3} style={{ animation: 'spin 1s linear infinite' }} /> Отправляем...</>
                : <><CreditCard size={17} color={disabled ? C.t3 : C.bg} strokeWidth={2} /> Вывести GEO</>
              }
            </button>

            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: C.t3 }}>
              1 GEO = {geoRate} UZS · без комиссии
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
