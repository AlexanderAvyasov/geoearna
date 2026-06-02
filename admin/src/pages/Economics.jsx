import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt } from '../lib/design.js';

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

  const revDaily   = daily.map(d => ({ ...d, value: d.revenue }));
  const payDaily   = daily.map(d => ({ ...d, value: d.payout  }));

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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
