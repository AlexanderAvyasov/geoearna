import { useEffect, useState } from 'react';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';

const ANIM = `
  @keyframes fadeUp { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes pop { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
`;

function Skeleton({ h = 20, w = '100%', r = 8 }) {
  return (
    <div style={{ background: '#F2F2F7', borderRadius: r, height: h, width: w, animation: 'pulse 1.4s infinite' }} />
  );
}

export default function Admin() {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notOwner, setNotOwner] = useState(false);
  const [pin, setPin] = useState(null);
  const [pinExpires, setPinExpires] = useState(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);

  const webappUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/business`, { headers: { initdata: initData } })
      .then(r => {
        if (r.status === 404 || r.status === 403) { setNotOwner(true); return null; }
        return r.json();
      })
      .then(d => { if (d) setBusiness(d.business); })
      .catch(() => setNotOwner(true))
      .finally(() => setLoading(false));
  }, []);

  async function generatePin() {
    setPinLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/pin`, {
        method: 'POST',
        headers: { initdata: initData },
      });
      const d = await r.json();
      if (r.ok) {
        setPin(d.pin);
        setPinExpires(new Date(d.expiresAt));
        setPinCopied(false);
      }
    } finally {
      setPinLoading(false);
    }
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
        <div style={{ marginTop: 16 }}>
          <Skeleton h={120} r={16} />
        </div>
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
          Обратитесь к администратору GeoEarn для подключения вашего заведения к системе.
        </div>
      </div>
    );
  }

  const qrUrl = business
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=1&data=${encodeURIComponent(`${webappUrl}/checkin?token=${business.qr_token}`)}`
    : null;

  const activeCampaign = (business?.campaigns || []).find(c => c.active);

  return (
    <div style={{ background: '#EFEFF4', minHeight: '100vh' }}>
      <style>{ANIM}</style>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(150deg, #1C1C1E 0%, #3C3C3E 100%)',
        padding: '28px 20px 44px', color: '#fff',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Бизнес-панель
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>{business.name}</div>
        {business.address && (
          <div style={{ fontSize: 13, opacity: 0.65 }}>📍 {business.address}</div>
        )}
      </div>

      <div style={{ marginTop: -20, borderRadius: '20px 20px 0 0', background: '#EFEFF4', paddingTop: 20 }}>
        <div style={{ padding: '0 16px' }}>

          {/* Balance */}
          <div style={{
            background: '#fff', borderRadius: 18, padding: '20px',
            marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            animation: 'fadeUp 0.3s ease',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 12, color: '#8E8E93', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                Баланс заведения
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1 }}>
                {(business.balance || 0).toLocaleString()}
                <span style={{ fontSize: 16, fontWeight: 500, color: '#8E8E93', marginLeft: 6 }}>сум</span>
              </div>
            </div>
            <div style={{ fontSize: 42 }}>💰</div>
          </div>

          {/* Active campaign stats */}
          {activeCampaign && (
            <div style={{
              background: '#fff', borderRadius: 18, padding: '20px',
              marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
              animation: 'fadeUp 0.3s 0.05s ease both',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 16 }}>
                Активная кампания
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, background: '#F2F2F7', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#2AABEE' }}>{activeCampaign.visits_count}</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Визитов</div>
                </div>
                <div style={{ flex: 1, background: '#F2F2F7', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#34C759' }}>{activeCampaign.max_visits - activeCampaign.visits_count}</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Осталось</div>
                </div>
                <div style={{ flex: 1, background: '#F2F2F7', borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#FF9500' }}>{activeCampaign.reward_amount.toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#8E8E93', marginTop: 2 }}>Сум/визит</div>
                </div>
              </div>
              {activeCampaign.requires_pin && (
                <div style={{
                  marginTop: 12, background: 'rgba(255,149,0,0.08)',
                  border: '1.5px solid rgba(255,149,0,0.25)',
                  borderRadius: 10, padding: '10px 12px',
                  fontSize: 13, color: '#CC7A00', fontWeight: 600,
                }}>
                  🔐 Кампания требует PIN-подтверждение
                </div>
              )}
            </div>
          )}

          {/* PIN generation */}
          <div style={{
            background: '#fff', borderRadius: 18, padding: '20px',
            marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
            animation: 'fadeUp 0.3s 0.1s ease both',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 16 }}>
              PIN для клиента
            </div>

            {pin ? (
              <div style={{ animation: 'pop 0.4s ease' }}>
                <div
                  onClick={copyPin}
                  style={{
                    background: 'linear-gradient(135deg, #FF9500, #e08000)',
                    borderRadius: 16, padding: '20px',
                    textAlign: 'center', cursor: 'pointer',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginBottom: 8, fontWeight: 600 }}>
                    {pinCopied ? '✅ СКОПИРОВАНО' : 'НАЖМИТЕ ЧТОБЫ СКОПИРОВАТЬ'}
                  </div>
                  <div style={{ fontSize: 48, fontWeight: 900, color: '#fff', letterSpacing: 12 }}>{pin}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 8 }}>
                    Действителен до {pinExpires?.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} (15 мин)
                  </div>
                </div>
                <button
                  onClick={generatePin}
                  disabled={pinLoading}
                  style={{
                    width: '100%', background: '#F2F2F7', border: 'none',
                    borderRadius: 12, padding: '13px', fontSize: 15,
                    fontWeight: 700, color: '#3C3C3E', cursor: 'pointer',
                  }}
                >
                  Сгенерировать новый
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.5, marginBottom: 16 }}>
                  Сгенерируйте одноразовый PIN-код и назовите его клиенту для подтверждения визита.
                </div>
                <button
                  onClick={generatePin}
                  disabled={pinLoading}
                  style={{
                    width: '100%',
                    background: pinLoading ? '#C7C7CC' : 'linear-gradient(135deg, #FF9500, #e08000)',
                    color: '#fff', border: 'none',
                    borderRadius: 14, padding: '16px',
                    fontSize: 16, fontWeight: 700,
                    cursor: pinLoading ? 'not-allowed' : 'pointer',
                    boxShadow: pinLoading ? 'none' : '0 4px 16px rgba(255,149,0,0.35)',
                  }}
                >
                  {pinLoading ? '⏳ Генерируем...' : '🔐 Создать PIN'}
                </button>
              </>
            )}
          </div>

          {/* QR Code */}
          {qrUrl && (
            <div style={{
              background: '#fff', borderRadius: 18, padding: '20px',
              marginBottom: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
              animation: 'fadeUp 0.3s 0.15s ease both',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 16, textAlign: 'left' }}>
                QR-код заведения
              </div>
              <img
                src={qrUrl}
                alt="QR Code"
                style={{
                  width: 200, height: 200,
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              />
              <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 12, lineHeight: 1.5 }}>
                Распечатайте и разместите в заведении.<br />Клиенты сканируют для чекина.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
