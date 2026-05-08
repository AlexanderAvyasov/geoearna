import { useEffect, useState } from 'react';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';

const ANIM = `
  @keyframes fadeUp { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes pop    { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
  @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
  @keyframes backdrop { from{opacity:0} to{opacity:1} }
`;

const STATUS_MAP = {
  pending:   { label: 'Ожидает',    color: '#FF9500', bg: 'rgba(255,149,0,0.1)' },
  confirmed: { label: 'Зачислено',  color: '#34C759', bg: 'rgba(52,199,89,0.1)' },
  rejected:  { label: 'Отклонено', color: '#FF3B30', bg: 'rgba(255,59,48,0.1)' },
};

function Skeleton({ h = 20, w = '100%', r = 8 }) {
  return <div style={{ background: '#F2F2F7', borderRadius: r, height: h, width: w, animation: 'pulse 1.4s infinite' }} />;
}

function TopupModal({ business, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState('form'); // form | details
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');

  const presets = [50000, 100000, 250000, 500000];

  async function handleSubmit(e) {
    e.preventDefault();
    const val = parseInt(amount.replace(/\s/g, ''), 10);
    if (!val || val < 10000) return;

    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', initdata: initData },
        body: JSON.stringify({ amount: val }),
      });
      const d = await r.json();
      if (r.ok) {
        setPaymentDetails(d.paymentDetails);
        setStep('details');
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  }

  function copy(text, key) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, animation: 'backdrop 0.25s ease' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '0 0 40px', maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.15)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E0E0E0', margin: '12px auto 20px' }} />

        {step === 'form' && (
          <div style={{ padding: '0 24px' }}>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Пополнить баланс</div>
            <div style={{ color: '#8E8E93', fontSize: 14, marginBottom: 24 }}>
              Минимальная сумма: 10 000 сум
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {presets.map(p => (
                  <button key={p} type="button"
                    onClick={() => setAmount(String(p))}
                    style={{
                      padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      border: amount === String(p) ? '2px solid #2AABEE' : '2px solid rgba(0,0,0,0.1)',
                      background: amount === String(p) ? 'rgba(42,171,238,0.08)' : '#F2F2F7',
                      color: amount === String(p) ? '#2AABEE' : '#3C3C3E',
                      cursor: 'pointer',
                    }}>
                    {p.toLocaleString()}
                  </button>
                ))}
              </div>

              <input
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="Введите сумму (сум)"
                inputMode="numeric"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '16px',
                  borderRadius: 14, border: '2px solid rgba(0,0,0,0.1)',
                  fontSize: 18, fontWeight: 700, outline: 'none',
                  background: '#F9F9F9', marginBottom: 20,
                }}
              />

              <button type="submit" disabled={loading || parseInt(amount, 10) < 10000}
                style={{
                  width: '100%',
                  background: (!loading && parseInt(amount, 10) >= 10000) ? 'linear-gradient(135deg, #2AABEE, #1a8fcc)' : '#C7C7CC',
                  color: '#fff', border: 'none', borderRadius: 14, padding: '16px',
                  fontSize: 16, fontWeight: 700,
                  cursor: (!loading && parseInt(amount, 10) >= 10000) ? 'pointer' : 'not-allowed',
                  boxShadow: (!loading && parseInt(amount, 10) >= 10000) ? '0 4px 16px rgba(42,171,238,0.35)' : 'none',
                }}>
                {loading ? '⏳ Создаём заявку...' : 'Получить реквизиты'}
              </button>
            </form>
          </div>
        )}

        {step === 'details' && paymentDetails && (
          <div style={{ padding: '0 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>💳</div>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Реквизиты для оплаты</div>
              <div style={{ color: '#8E8E93', fontSize: 14 }}>
                Переведите ровно <strong>{paymentDetails.amount.toLocaleString()} сум</strong>
              </div>
            </div>

            {[
              { label: 'Карта', value: paymentDetails.cardNumber, key: 'card' },
              { label: 'Получатель', value: paymentDetails.cardHolder, key: 'holder' },
              { label: 'Банк', value: paymentDetails.bank, key: 'bank' },
              { label: 'Комментарий', value: paymentDetails.comment, key: 'comment' },
            ].map(({ label, value, key }) => (
              <div key={key} onClick={() => copy(value, key)} style={{
                background: '#F2F2F7', borderRadius: 12, padding: '14px 16px',
                marginBottom: 10, display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', cursor: 'pointer',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 600, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
                </div>
                <div style={{ fontSize: 13, color: copied === key ? '#34C759' : '#2AABEE', fontWeight: 600 }}>
                  {copied === key ? '✅' : 'Копировать'}
                </div>
              </div>
            ))}

            <div style={{
              background: 'rgba(42,171,238,0.08)', border: '1.5px solid rgba(42,171,238,0.2)',
              borderRadius: 12, padding: '12px 14px', marginTop: 16, marginBottom: 20,
              fontSize: 13, color: '#1a8fcc', lineHeight: 1.5,
            }}>
              ℹ️ После оплаты баланс будет пополнен в течение рабочего дня. Статус заявки можно отследить в истории.
            </div>

            <button onClick={onClose} style={{
              width: '100%', background: '#F2F2F7', border: 'none',
              borderRadius: 14, padding: '15px', fontSize: 16,
              fontWeight: 700, color: '#3C3C3E', cursor: 'pointer',
            }}>
              Готово
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function Admin() {
  const [business, setBusiness]   = useState(null);
  const [topups, setTopups]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [notOwner, setNotOwner]   = useState(false);
  const [pin, setPin]             = useState(null);
  const [pinExpires, setPinExpires] = useState(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [showTopup, setShowTopup] = useState(false);

  const webappUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function loadData() {
    const h = { initdata: initData };
    Promise.all([
      fetch(`${API_BASE}/api/admin/business`, { headers: h }),
      fetch(`${API_BASE}/api/admin/topups`, { headers: h }),
    ])
      .then(async ([bRes, tRes]) => {
        if (bRes.status === 404 || bRes.status === 403) { setNotOwner(true); return; }
        const bData = await bRes.json();
        const tData = tRes.ok ? await tRes.json() : { requests: [] };
        setBusiness(bData.business);
        setTopups(tData.requests || []);
      })
      .catch(() => setNotOwner(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function generatePin() {
    setPinLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/pin`, { method: 'POST', headers: { initdata: initData } });
      const d = await r.json();
      if (r.ok) { setPin(d.pin); setPinExpires(new Date(d.expiresAt)); setPinCopied(false); }
    } finally { setPinLoading(false); }
  }

  function copyPin() {
    if (!pin) return;
    navigator.clipboard?.writeText(pin).catch(() => {});
    setPinCopied(true);
    setTimeout(() => setPinCopied(false), 2000);
  }

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <style>{ANIM}</style>
        <Skeleton h={48} r={16} />
        <div style={{ marginTop: 16 }}><Skeleton h={120} r={16} /></div>
      </div>
    );
  }

  if (notOwner) {
    return (
      <div style={{ padding: 32, textAlign: 'center', paddingTop: 80 }}>
        <style>{ANIM}</style>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🏪</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 12 }}>Панель бизнеса</div>
        <div style={{ color: '#8E8E93', fontSize: 15, lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
          Вы не зарегистрированы как владелец заведения.<br /><br />
          Обратитесь к администратору GeoEarn для подключения.
        </div>
      </div>
    );
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=1&data=${encodeURIComponent(`${webappUrl}/checkin?token=${business.qr_token}`)}`;
  const activeCampaign = (business?.campaigns || []).find(c => c.active);

  return (
    <div style={{ background: '#EFEFF4', minHeight: '100vh' }}>
      <style>{ANIM}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(150deg, #1C1C1E 0%, #3C3C3E 100%)', padding: '28px 20px 44px', color: '#fff' }}>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Бизнес-панель</div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{business.name}</div>
        {business.address && <div style={{ fontSize: 13, opacity: 0.65 }}>📍 {business.address}</div>}
      </div>

      <div style={{ marginTop: -20, borderRadius: '20px 20px 0 0', background: '#EFEFF4', paddingTop: 20 }}>
        <div style={{ padding: '0 16px' }}>

          {/* Balance + Topup button */}
          <div style={{
            background: '#fff', borderRadius: 18, padding: '20px',
            marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            animation: 'fadeUp 0.3s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#8E8E93', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Баланс заведения</div>
                <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1 }}>
                  {(business.balance || 0).toLocaleString()}
                  <span style={{ fontSize: 16, fontWeight: 500, color: '#8E8E93', marginLeft: 6 }}>сум</span>
                </div>
              </div>
              <div style={{ fontSize: 42 }}>💰</div>
            </div>
            <button
              onClick={() => setShowTopup(true)}
              style={{
                width: '100%', background: 'linear-gradient(135deg, #34C759, #25a244)',
                color: '#fff', border: 'none', borderRadius: 12, padding: '13px',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(52,199,89,0.3)',
              }}>
              + Пополнить баланс
            </button>
          </div>

          {/* Active campaign stats */}
          {activeCampaign && (
            <div style={{ background: '#fff', borderRadius: 18, padding: '20px', marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', animation: 'fadeUp 0.3s 0.05s ease both' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 16 }}>Активная кампания</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { val: activeCampaign.visits_count, label: 'Визитов', color: '#2AABEE' },
                  { val: activeCampaign.max_visits - activeCampaign.visits_count, label: 'Осталось', color: '#34C759' },
                  { val: activeCampaign.reward_amount.toLocaleString(), label: 'Сум/визит', color: '#FF9500', small: true },
                ].map(({ val, label, color, small }) => (
                  <div key={label} style={{ flex: 1, background: '#F2F2F7', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: small ? 22 : 28, fontWeight: 900, color }}>{val}</div>
                    <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              {activeCampaign.requires_pin && (
                <div style={{ marginTop: 12, background: 'rgba(255,149,0,0.08)', border: '1.5px solid rgba(255,149,0,0.25)', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#CC7A00', fontWeight: 600 }}>
                  🔐 Кампания требует PIN-подтверждение
                </div>
              )}
            </div>
          )}

          {/* PIN generation */}
          <div style={{ background: '#fff', borderRadius: 18, padding: '20px', marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', animation: 'fadeUp 0.3s 0.1s ease both' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 16 }}>PIN для клиента</div>
            {pin ? (
              <div style={{ animation: 'pop 0.4s ease' }}>
                <div onClick={copyPin} style={{ background: 'linear-gradient(135deg, #FF9500, #e08000)', borderRadius: 16, padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 8, fontWeight: 600 }}>{pinCopied ? '✅ СКОПИРОВАНО' : 'НАЖМИТЕ ЧТОБЫ СКОПИРОВАТЬ'}</div>
                  <div style={{ fontSize: 48, fontWeight: 900, color: '#fff', letterSpacing: 12 }}>{pin}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 8 }}>До {pinExpires?.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} (15 мин)</div>
                </div>
                <button onClick={generatePin} disabled={pinLoading} style={{ width: '100%', background: '#F2F2F7', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, color: '#3C3C3E', cursor: 'pointer' }}>Сгенерировать новый</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.5, marginBottom: 16 }}>Сгенерируйте одноразовый PIN и назовите его клиенту.</div>
                <button onClick={generatePin} disabled={pinLoading} style={{ width: '100%', background: pinLoading ? '#C7C7CC' : 'linear-gradient(135deg, #FF9500, #e08000)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px', fontSize: 16, fontWeight: 700, cursor: pinLoading ? 'not-allowed' : 'pointer', boxShadow: pinLoading ? 'none' : '0 4px 16px rgba(255,149,0,0.35)' }}>
                  {pinLoading ? '⏳ Генерируем...' : '🔐 Создать PIN'}
                </button>
              </>
            )}
          </div>

          {/* Top-up history */}
          {topups.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 18, padding: '20px', marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', animation: 'fadeUp 0.3s 0.15s ease both' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 16 }}>История пополнений</div>
              {topups.map(t => {
                const s = STATUS_MAP[t.status] || STATUS_MAP.pending;
                return (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid #F2F2F7' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{t.amount.toLocaleString()} сум</div>
                      <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
                        {new Date(t.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </div>
                      {t.note && <div style={{ fontSize: 12, color: '#FF3B30', marginTop: 2 }}>{t.note}</div>}
                    </div>
                    <div style={{ background: s.bg, color: s.color, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                      {s.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* QR Code */}
          <div style={{ background: '#fff', borderRadius: 18, padding: '20px', marginBottom: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', animation: 'fadeUp 0.3s 0.2s ease both', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 16, textAlign: 'left' }}>QR-код заведения</div>
            <img src={qrUrl} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }} />
            <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 12, lineHeight: 1.5 }}>Распечатайте и разместите в заведении.<br />Клиенты сканируют для чекина.</div>
          </div>

        </div>
      </div>

      {showTopup && (
        <TopupModal
          business={business}
          onClose={() => setShowTopup(false)}
          onSuccess={() => {
            setShowTopup(false);
            // Reload topup history after short delay
            setTimeout(loadData, 1000);
          }}
        />
      )}
    </div>
  );
}
