import { useEffect, useState } from 'react';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { formatGeo } from '../lib/geo';
import { C, G, E, sk, cardBase, inputStyle } from '../lib/design';

const STATUS_MAP = {
  pending:   { label: 'Ожидает',   color: C.orange, bg: C.goldFt },
  confirmed: { label: 'Зачислено', color: C.geo,    bg: C.geoFt  },
  rejected:  { label: 'Отклонено', color: C.red,    bg: C.redFt  },
};

const COMMISSION = 0.10;

function calcReward(budget, visits) {
  if (!budget || !visits || visits === 0) return 0;
  return Math.floor((budget * (1 - COMMISSION)) / visits);
}

function Skel({ h = 20, w = '100%', r = 8 }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: r, flexShrink: 0,
      background: `linear-gradient(90deg, ${C.card} 0%, rgba(255,255,255,0.06) 50%, ${C.card} 100%)`,
      backgroundSize: '600px 100%',
      animation: 'shimmer 1.6s ease-in-out infinite',
    }} />
  );
}

function Toggle({ on, onToggle }) {
  return (
    <div onClick={onToggle} style={{
      width: 44, height: 26, borderRadius: 13,
      background: on ? C.geo : C.b2,
      transition: 'background 0.2s',
      position: 'relative', cursor: 'pointer',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 3,
        left: on ? 21 : 3,
        width: 20, height: 20,
        borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        transition: `left 0.2s ${E.spring}`,
      }} />
    </div>
  );
}

function CampaignForm({ balance, onClose, onCreated }) {
  const [budget,     setBudget]     = useState('');
  const [visits,     setVisits]     = useState('');
  const [taskType,   setTaskType]   = useState('visit');
  const [desc,       setDesc]       = useState('');
  const [requiresPin, setRequiresPin] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const budgetNum  = parseInt(budget, 10) || 0;
  const visitsNum  = parseInt(visits, 10) || 0;
  const reward     = calcReward(budgetNum, visitsNum);
  const commission = budgetNum - reward * visitsNum;
  const canSubmit  = budgetNum >= 1000 && visitsNum >= 1 && reward >= 1 && budgetNum <= balance;

  const [fBudget, setFBudget] = useState(false);
  const [fVisits, setFVisits] = useState(false);
  const [fDesc,   setFDesc]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', initdata: initData },
        body: JSON.stringify({
          budget: budgetNum, max_visits: visitsNum,
          task_type: taskType, task_description: desc || null,
          requires_pin: requiresPin,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        const msgs = {
          INSUFFICIENT_BALANCE: 'Недостаточно GEO на балансе заведения.',
          REWARD_TOO_LOW: 'Слишком маленькое вознаграждение — увеличьте бюджет или уменьшите активации.',
        };
        setError(msgs[d.error] || 'Ошибка создания кампании.');
        return;
      }
      onCreated(d.campaign);
    } finally { setLoading(false); }
  }

  const TASK_TYPES = [
    { value: 'visit',    label: '📍 Визит' },
    { value: 'purchase', label: '🛍 Покупка' },
    { value: 'review',   label: '⭐ Отзыв' },
  ];

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 200, animation: 'backdropIn 0.25s ease',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: C.surf,
        borderRadius: '28px 28px 0 0',
        border: `1px solid ${C.b1}`, borderBottom: 'none',
        maxWidth: 480, margin: '0 auto',
        maxHeight: '92vh', overflowY: 'auto',
        animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 60px rgba(0,0,0,0.7)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 0' }} />

        <div style={{ padding: '20px 22px 48px' }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4, color: C.t1 }}>Новая кампания</div>
          <div style={{ color: C.t3, fontSize: 14, marginBottom: 24 }}>
            Баланс: <strong style={{ color: C.geo }}>{formatGeo(balance)} GEO</strong>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Budget */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>Бюджет кампании (GEO)</div>
              <input
                value={budget}
                onChange={e => setBudget(e.target.value.replace(/\D/g, ''))}
                placeholder="Например: 500 000"
                inputMode="numeric"
                onFocus={() => setFBudget(true)}
                onBlur={() => setFBudget(false)}
                style={inputStyle(fBudget)}
              />
            </div>

            {/* Activations */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>Количество активаций</div>
              <input
                value={visits}
                onChange={e => setVisits(e.target.value.replace(/\D/g, ''))}
                placeholder="Например: 100"
                inputMode="numeric"
                onFocus={() => setFVisits(true)}
                onBlur={() => setFVisits(false)}
                style={inputStyle(fVisits)}
              />
            </div>

            {/* Live formula */}
            {budgetNum > 0 && visitsNum > 0 && (
              <div style={{
                background: reward >= 1 ? C.geoFt : C.redFt,
                border: `1.5px solid ${reward >= 1 ? C.geoGl : 'rgba(255,59,92,0.25)'}`,
                borderRadius: 14, padding: '16px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Расчёт по формуле
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 13, color: C.t2, lineHeight: 2 }}>
                  <div>Бюджет:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong style={{ color: C.t1 }}>{formatGeo(budgetNum)} GEO</strong></div>
                  <div style={{ color: C.red }}>− Комиссия 10%:&nbsp;&nbsp;<strong>{formatGeo(commission)} GEO</strong></div>
                  <div style={{ borderTop: `1px solid ${C.b1}`, paddingTop: 8, marginTop: 4 }}>
                    ÷ Активаций:&nbsp;&nbsp;&nbsp;&nbsp;<strong style={{ color: C.t1 }}>{visitsNum}</strong>
                  </div>
                  <div style={{ borderTop: `1px solid ${C.b1}`, paddingTop: 8, marginTop: 4, fontSize: 16, color: reward >= 1 ? C.geo : C.red, fontWeight: 900 }}>
                    = За задание:&nbsp;&nbsp;&nbsp;&nbsp;<strong>{formatGeo(reward)} GEO</strong>
                  </div>
                </div>
                {reward < 1 && (
                  <div style={{ color: C.red, fontSize: 12, marginTop: 8, fontWeight: 600 }}>
                    ↑ Увеличьте бюджет или уменьшите активации
                  </div>
                )}
              </div>
            )}

            {/* Task type */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>Тип задания</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {TASK_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setTaskType(t.value)}
                    style={{
                      flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                      border: taskType === t.value ? `2px solid ${C.blue}` : `2px solid ${C.b1}`,
                      background: taskType === t.value ? C.blueFt : C.card,
                      color: taskType === t.value ? C.blue : C.t2,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 }}>Описание задания (необязательно)</div>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Что должен сделать клиент..."
                rows={3}
                onFocus={() => setFDesc(true)}
                onBlur={() => setFDesc(false)}
                style={{ ...inputStyle(fDesc), resize: 'none', fontFamily: 'inherit' }}
              />
            </div>

            {/* PIN toggle */}
            <div onClick={() => setRequiresPin(p => !p)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: C.card, border: `1px solid ${C.b0}`,
                borderRadius: 14, padding: '14px 16px',
                marginBottom: 22, cursor: 'pointer',
              }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.t1 }}>🔐 Требовать PIN</div>
                <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>Сотрудник называет PIN клиенту</div>
              </div>
              <Toggle on={requiresPin} onToggle={() => setRequiresPin(p => !p)} />
            </div>

            {error && (
              <div style={{
                background: C.redFt, color: C.red, borderRadius: 12,
                padding: '10px 14px', fontSize: 14, fontWeight: 600,
                marginBottom: 16, border: `1px solid rgba(255,59,92,0.2)`,
              }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={!canSubmit || loading}
              style={{
                width: '100%',
                background: canSubmit && !loading ? G.blue : C.b2,
                color: canSubmit && !loading ? '#fff' : C.t3,
                border: 'none', borderRadius: 16, padding: '17px',
                fontSize: 16, fontWeight: 700,
                cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit && !loading ? `0 6px 24px ${C.blueGl}` : 'none',
                transition: 'all 0.2s',
              }}>
              {loading ? '⏳ Создаём...' : `Запустить · ${formatGeo(reward)} GEO / задание`}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default function Admin() {
  const [business,   setBusiness]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [notOwner,   setNotOwner]   = useState(false);
  const [pin,        setPin]        = useState(null);
  const [pinExpires, setPinExpires] = useState(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinCopied,  setPinCopied]  = useState(false);
  const [showForm,   setShowForm]   = useState(false);

  const webappUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function loadData() {
    fetch(`${API_BASE}/api/admin/business`, { headers: { initdata: initData } })
      .then(async r => {
        if (r.status === 404 || r.status === 403) { setNotOwner(true); return; }
        const d = await r.json();
        setBusiness(d.business);
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
      <div style={{ background: C.bg, minHeight: '100vh', padding: 20 }}>
        <Skel h={120} r={20} />
        <div style={{ marginTop: 16 }}><Skel h={80} r={20} /></div>
        <div style={{ marginTop: 16 }}><Skel h={160} r={20} /></div>
      </div>
    );
  }

  if (notOwner) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🏪</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 12, color: C.t1 }}>Панель бизнеса</div>
        <div style={{ color: C.t3, fontSize: 15, lineHeight: 1.6, maxWidth: 280 }}>
          Вы не зарегистрированы как владелец заведения.<br /><br />
          Обратитесь к администратору GeoEarn для подключения.
        </div>
      </div>
    );
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=1&bgcolor=13161F&color=FFFFFF&data=${encodeURIComponent(`${webappUrl}/checkin?token=${business.qr_token}`)}`;
  const activeCampaign = (business?.campaigns || []).find(c => c.active);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', animation: 'pageEnter 0.4s ease both' }}>
      {/* Header */}
      <div style={{
        background: G.admin,
        padding: '32px 20px 52px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,184,0,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
          Бизнес-панель
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, color: C.t1, letterSpacing: -0.5 }}>
          {business.name}
        </div>
        {business.address && (
          <div style={{ fontSize: 13, color: C.t3 }}>📍 {business.address}</div>
        )}
      </div>

      <div style={{
        marginTop: -24, borderRadius: '28px 28px 0 0',
        background: C.bg, border: `1px solid ${C.b0}`, borderBottom: 'none',
        paddingTop: 22,
      }}>
        <div style={{ padding: '0 16px' }}>

          {/* Balance card */}
          <div style={{
            ...cardBase, border: `1px solid ${C.b1}`,
            padding: '20px', marginBottom: 14,
            animation: 'fadeUp 0.35s ease both',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Баланс заведения</div>
                <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, color: C.t1 }}>
                  {formatGeo(business.balance || 0)}
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.t3, marginLeft: 8 }}>GEO</span>
                </div>
              </div>
              <div style={{ fontSize: 38 }}>💰</div>
            </div>
            {/* Campaign CTA */}
            <button
              onClick={() => setShowForm(true)}
              style={{
                width: '100%', background: G.geo,
                color: '#071a0c', border: 'none', borderRadius: 14, padding: '14px',
                fontSize: 15, fontWeight: 800, cursor: 'pointer',
                boxShadow: `0 4px 16px ${C.geoGl}`,
              }}>
              + Создать кампанию
            </button>
          </div>

          {/* Active campaign */}
          {activeCampaign && (
            <div style={{
              ...cardBase, border: `1px solid ${C.geoGl}`,
              padding: '20px', marginBottom: 14,
              animation: 'fadeUp 0.35s 0.05s ease both',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.geo, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 16 }}>
                🟢 Активная кампания
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { val: activeCampaign.visits_count, label: 'Визитов', color: C.blue },
                  { val: activeCampaign.max_visits - activeCampaign.visits_count, label: 'Осталось', color: C.geo },
                  { val: `${formatGeo(activeCampaign.reward_amount)}`, label: 'GEO/визит', color: C.gold },
                ].map(({ val, label, color }) => (
                  <div key={label} style={{
                    flex: 1, background: C.cardHi,
                    border: `1px solid ${C.b0}`,
                    borderRadius: 12, padding: '14px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color }}>{val}</div>
                    <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
              {activeCampaign.requires_pin && (
                <div style={{
                  marginTop: 12, background: C.goldFt, border: `1.5px solid ${C.goldGl}`,
                  borderRadius: 10, padding: '10px 12px', fontSize: 13, color: C.gold, fontWeight: 600,
                }}>
                  🔐 Кампания требует PIN-подтверждение
                </div>
              )}
            </div>
          )}

          {/* PIN generation */}
          <div style={{
            ...cardBase, border: `1px solid ${C.b1}`,
            padding: '20px', marginBottom: 14,
            animation: 'fadeUp 0.35s 0.1s ease both',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 16 }}>
              PIN для клиента
            </div>
            {pin ? (
              <div style={{ animation: 'pop 0.4s ease' }}>
                <div onClick={copyPin} style={{
                  background: G.gold, borderRadius: 16, padding: '20px',
                  textAlign: 'center', cursor: 'pointer', marginBottom: 12,
                  boxShadow: `0 6px 24px ${C.goldGl}`,
                }}>
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {pinCopied ? '✅ СКОПИРОВАНО' : 'НАЖМИТЕ ЧТОБЫ СКОПИРОВАТЬ'}
                  </div>
                  <div style={{ fontSize: 52, fontWeight: 900, color: '#1a0800', letterSpacing: 14 }}>{pin}</div>
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 8 }}>
                    До {pinExpires?.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} (15 мин)
                  </div>
                </div>
                <button onClick={generatePin} disabled={pinLoading} style={{
                  width: '100%', background: C.card, border: `1px solid ${C.b1}`,
                  borderRadius: 12, padding: '13px', fontSize: 15,
                  fontWeight: 700, color: C.t2, cursor: 'pointer',
                }}>
                  Сгенерировать новый
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 14, color: C.t3, lineHeight: 1.5, marginBottom: 16 }}>
                  Сгенерируйте одноразовый PIN и назовите его клиенту.
                </div>
                <button onClick={generatePin} disabled={pinLoading} style={{
                  width: '100%',
                  background: pinLoading ? C.b2 : G.gold,
                  color: pinLoading ? C.t3 : '#1a0800',
                  border: 'none', borderRadius: 14, padding: '16px',
                  fontSize: 16, fontWeight: 700,
                  cursor: pinLoading ? 'not-allowed' : 'pointer',
                  boxShadow: pinLoading ? 'none' : `0 6px 24px ${C.goldGl}`,
                  transition: 'all 0.2s',
                }}>
                  {pinLoading ? '⏳ Генерируем...' : '🔐 Создать PIN'}
                </button>
              </>
            )}
          </div>

          {/* QR Code */}
          <div style={{
            ...cardBase, border: `1px solid ${C.b1}`,
            padding: '20px', marginBottom: 32,
            animation: 'fadeUp 0.35s 0.15s ease both',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 16, textAlign: 'left' }}>
              QR-код заведения
            </div>
            <div style={{
              display: 'inline-block', padding: 12, borderRadius: 16,
              background: C.cardHi, border: `1px solid ${C.b1}`,
            }}>
              <img src={qrUrl} alt="QR Code" style={{ width: 180, height: 180, borderRadius: 8, display: 'block' }} />
            </div>
            <div style={{ fontSize: 13, color: C.t3, marginTop: 14, lineHeight: 1.5 }}>
              Распечатайте и разместите в заведении.<br />Клиенты сканируют для чекина.
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <CampaignForm
          balance={business.balance || 0}
          onClose={() => setShowForm(false)}
          onCreated={campaign => {
            setShowForm(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
