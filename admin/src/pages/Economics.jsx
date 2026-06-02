import React, { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Loader2, Coins,
  Activity, Clock, ArrowDownToLine, QrCode, Target, Users,
  ChevronDown, RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt, fmtDate } from '../lib/design.js';

function BarChart({ data = [], valueKey = 'revenue', color = C.accent, height = 120 }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height, paddingTop: 8 }}>
      {data.map((d, i) => {
        const pct = (d[valueKey] || 0) / max;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{
              width: '100%', background: color, borderRadius: '3px 3px 0 0',
              height: `${Math.max(pct * (height - 22), 2)}px`,
              opacity: i === data.length - 1 ? 1 : 0.5,
              transition: 'height 0.5s ease',
            }} />
            <span style={{ fontSize: 9, color: C.t3 }}>{d.date?.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

function EconCard({ label, value, sub, color = C.t1, icon: Icon, iconColor }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: C.t3, fontWeight: 600, letterSpacing: 0.3 }}>{label}</div>
        {Icon && (
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `${iconColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={15} color={iconColor} />
          </div>
        )}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const WALLET_TX_CFG = {
  commission:         { color: C.green,  sign: '+', Icon: Coins,           label: 'Комиссия'        },
  withdrawal:         { color: C.red,    sign: '−', Icon: ArrowDownToLine,  label: 'Вывод'           },
  withdrawal_pending: { color: C.gold,   sign: '−', Icon: Clock,            label: 'Вывод (ожидает)' },
  promo:              { color: C.blue,   sign: '−', Icon: QrCode,           label: 'Promo QR'        },
  geohunt:            { color: C.orange, sign: '−', Icon: Target,           label: 'GeoHunt'         },
  referral_bonus:     { color: C.purple, sign: '−', Icon: Users,            label: 'Реф. бонус'      },
};

function WalletHistory() {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  function load() {
    setLoading(true);
    api.get('/api/superadmin/platform-wallet/history')
      .then(r => r.ok ? r.json() : { history: [] })
      .then(d => setHistory(d.history || []))
      .finally(() => setLoading(false));
  }

  function toggle() {
    if (!open && history === null) load();
    setOpen(o => !o);
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 16, overflow: 'hidden' }}>
      <button onClick={toggle} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={14} color={C.t3} />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5 }}>История операций кошелька</span>
        </div>
        <ChevronDown size={14} color={C.t3} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{ padding: '0 18px 16px', borderTop: `1px solid ${C.border}` }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Loader2 size={18} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            </div>
          )}
          {!loading && history?.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: C.t3 }}>Операций нет</div>
          )}
          {!loading && history?.map((tx, i) => {
            const s = WALLET_TX_CFG[tx.type] || WALLET_TX_CFG.commission;
            return (
              <div key={tx.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${s.color}14`, border: `1px solid ${s.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.Icon size={13} color={s.color} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.label}</div>
                    <div style={{ fontSize: 11, color: C.t3 }}>{fmtDate(tx.created_at)}</div>
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: s.color, letterSpacing: -0.3 }}>
                    {s.sign}{fmt(tx.amount)} GEO
                  </div>
                </div>
              </div>
            );
          })}
          {!loading && history?.length > 0 && (
            <button onClick={load} style={{ marginTop: 10, width: '100%', padding: '8px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <RefreshCw size={12} /> Обновить
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function GeoRateSection({ currentRate }) {
  const [rateInput,  setRateInput]  = useState(String(currentRate || ''));
  const [note,       setNote]       = useState('');
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState('');
  const [history,    setHistory]    = useState(null);

  useEffect(() => {
    api.get('/api/superadmin/platform-config')
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.rateHistory && setHistory(d.rateHistory));
  }, []);

  async function save() {
    const r = parseFloat(rateInput);
    if (!r || r <= 0) return setMsg('Введите корректный курс');
    setLoading(true);
    const res = await api.post('/api/superadmin/config/rate', { rate: r, note });
    if (res.ok) {
      const d = await res.json();
      setMsg(d.warning || `✓ Записано: 1 GEO = ${r} UZS`);
      setNote('');
      // reload history
      api.get('/api/superadmin/platform-config')
        .then(r => r.ok ? r.json() : null)
        .then(d => d?.rateHistory && setHistory(d.rateHistory));
    } else {
      setMsg('Ошибка сохранения');
    }
    setLoading(false);
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Coins size={14} color={C.accent} />
        <span style={{ fontSize: 12, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Изменить курс GEO</span>
      </div>

      <div style={{ fontSize: 36, fontWeight: 800, color: C.accent, letterSpacing: -1, marginBottom: 4 }}>
        {currentRate} <span style={{ fontSize: 16, color: C.t3, fontWeight: 400 }}>UZS / GEO</span>
      </div>
      <div style={{ fontSize: 12, color: C.t3, marginBottom: 18 }}>Текущий курс из Railway GEO_RATE</div>

      <div style={{ display: 'grid', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 5 }}>Новый курс (UZS за 1 GEO)</div>
          <input
            value={rateInput} onChange={e => setRateInput(e.target.value)}
            placeholder="например: 1200" type="number"
            style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t1, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 5 }}>Комментарий</div>
          <input
            value={note} onChange={e => setNote(e.target.value)}
            placeholder="Причина изменения..."
            style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t1, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      </div>

      {msg && (
        <div style={{ fontSize: 13, color: msg.startsWith('✓') ? C.green : C.red, marginTop: 10, fontWeight: 600 }}>{msg}</div>
      )}

      <button onClick={save} disabled={loading}
        style={{ marginTop: 14, width: '100%', padding: '11px', background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 10, color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Coins size={14} />}
        Записать в историю
      </button>

      <div style={{ fontSize: 11, color: C.t3, marginTop: 10, lineHeight: 1.5 }}>
        ⚠ Чтобы изменение вступило в силу — обновите <strong>GEO_RATE</strong> в Railway и перезапустите сервис.
      </div>

      {history?.length > 0 && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>История изменений</div>
          {history.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: i < history.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.accent }}>{r.rate} UZS/GEO</div>
                <div style={{ fontSize: 11, color: C.t3 }}>{r.note || '—'}</div>
              </div>
              <div style={{ fontSize: 11, color: C.t3 }}>{fmtDate(r.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Economics() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/superadmin/economics')
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', paddingTop: 80 }}>
      <Loader2 size={26} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!data) return <div style={{ color: C.t3, textAlign: 'center', paddingTop: 80 }}>Нет данных</div>;

  const { totalRevenue, totalPayout, totalIssued, approvedGeo, pendingGeo, platformBalance, margin, geoRate, daily = [] } = data;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Финансы</h1>
        <div style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>Курс GEO: {fmt(geoRate)} UZS / 1 GEO</div>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <EconCard label="Выручка (UZS)"      value={`${fmt(totalRevenue)} ₽`}   color={C.green}  icon={TrendingUp}   iconColor={C.green}  sub="Всего пополнений" />
        <EconCard label="Выплачено (UZS)"    value={`${fmt(totalPayout)} ₽`}    color={C.red}    icon={TrendingDown} iconColor={C.red}    sub="Одобренные выводы" />
        <EconCard label="Маржа (UZS)"        value={`${fmt(margin)} ₽`}         color={margin >= 0 ? C.green : C.red} icon={DollarSign} iconColor={C.gold} sub="Выручка − Выплаты" />
        <EconCard label="GEO в обороте"      value={`${fmt(totalIssued)}`}      color={C.gold}   sub="Всего выдано за визиты" />
        <EconCard label="Одобрено GEO"       value={`${fmt(approvedGeo)}`}      color={C.orange} sub="Выведено пользователями" />
        <EconCard label="Ожидает вывода GEO" value={`${fmt(pendingGeo)}`}       color={C.orange} sub="Pending заявки" />
        <EconCard label="Баланс платформы"   value={`${fmt(platformBalance)}`}  color={C.accent} sub="GEO на счёте" />
        <EconCard label="Курс GEO"           value={`${fmt(geoRate)} UZS`}      color={C.blue}   sub="1 GEO" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 4 }}>Выручка за 7 дней (UZS)</div>
          <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>по дням</div>
          <BarChart data={daily} valueKey="revenue" color={C.green} height={120} />
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 4 }}>Выплаты за 7 дней (UZS)</div>
          <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>по дням</div>
          <BarChart data={daily} valueKey="payout" color={C.red} height={120} />
        </div>
      </div>

      {/* GEO rate change */}
      <GeoRateSection currentRate={geoRate} />

      {/* Wallet history */}
      <WalletHistory />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
