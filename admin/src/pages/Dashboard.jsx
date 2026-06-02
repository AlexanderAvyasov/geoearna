import React, { useEffect, useState } from 'react';
import {
  Users, Activity, MapPin, Wallet, TrendingUp, Store,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle, AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt, fmtDate } from '../lib/design.js';
import Sparkline from '../components/Sparkline.jsx';

function StatCard({ icon: Icon, iconColor, iconBg, label, value, sub, subColor, spark, sparkColor }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 12, color: C.t3, fontWeight: 600, letterSpacing: 0.3, marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.t1, letterSpacing: -0.8, lineHeight: 1 }}>
            {value ?? <span style={{ opacity: 0.3 }}>—</span>}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: subColor || C.t3, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              {sub}
            </div>
          )}
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: iconBg, border: `1px solid ${iconColor}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} color={iconColor} strokeWidth={2} />
        </div>
      </div>
      {spark && <Sparkline values={spark} color={sparkColor || iconColor} width={100} height={28} />}
    </div>
  );
}

function ActivityRow({ item }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: C.accentD, border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: C.accent,
      }}>
        {(item.username || item.telegram_id || '?')[0]?.toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.username ? `@${item.username}` : `#${item.telegram_id}`}
        </div>
        <div style={{ fontSize: 11, color: C.t3 }}>{item.action}</div>
      </div>
      <div style={{ fontSize: 12, color: C.t3, flexShrink: 0 }}>{fmtDate(item.created_at)}</div>
    </div>
  );
}

function genSpark(base, len = 10) {
  const arr = [];
  let v = base * 0.7;
  for (let i = 0; i < len; i++) {
    v += (Math.random() - 0.4) * base * 0.15;
    arr.push(Math.max(0, v));
  }
  arr[arr.length - 1] = base;
  return arr;
}

export default function Dashboard() {
  const [stats,   setStats]   = useState(null);
  const [ov,      setOv]      = useState(null);
  const [wds,     setWds]     = useState([]);
  const [audit,   setAudit]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/superadmin/stats').then(r => r.ok ? r.json() : null),
      api.get('/api/superadmin/overview').then(r => r.ok ? r.json() : null),
      api.get('/api/superadmin/withdrawals?status=pending').then(r => r.ok ? r.json() : { withdrawals: [] }),
      api.get('/api/superadmin/audit-log').then(r => r.ok ? r.json() : { log: [] }),
    ]).then(([s, o, w, a]) => {
      setStats(s);
      setOv(o);
      setWds(w?.withdrawals || []);
      setAudit((a?.log || []).slice(0, 8).map(l => ({
        username: null, telegram_id: l.target_id,
        action: l.action, created_at: l.created_at,
      })));
    }).finally(() => setLoading(false));
  }, []);

  const s = stats || {};
  const o = ov   || {};

  const CARDS = [
    { icon: Users,      iconColor: C.blue,   iconBg: C.blueD,   label: 'Пользователи', value: fmt(s.userCount),     sub: `${fmt(o.dau)} активных сегодня`,       subColor: C.green,  spark: genSpark(s.userCount  || 1000) },
    { icon: Activity,   iconColor: C.green,  iconBg: C.greenD,  label: 'Активные 24ч', value: fmt(o.dau),           sub: `${fmt(o.dauTrend)}% vs вчера`,         subColor: o.dauTrend >= 0 ? C.green : C.red,  spark: genSpark(o.dau  || 100) },
    { icon: MapPin,     iconColor: C.purple, iconBg: C.purpleD, label: 'Визиты',       value: fmt(s.visitCount),    sub: `${fmt(o.checkinsToday)} сегодня`,       subColor: C.t3,     spark: genSpark(s.visitCount || 500) },
    { icon: Wallet,     iconColor: C.orange, iconBg: C.orangeD, label: 'Баланс платф.', value: fmt(s.platformBalance) + ' GEO', sub: `${fmt(s.pendingGeo)} GEO ожидает вывода`, subColor: C.gold, spark: genSpark(s.platformBalance || 1000) },
    { icon: TrendingUp, iconColor: C.gold,   iconBg: C.goldD,   label: 'Выдано GEO',   value: fmt(s.totalGeoIssued),sub: `${fmt(s.activeCampaigns)} активных кампаний`, subColor: C.t3, spark: genSpark(s.totalGeoIssued || 5000) },
    { icon: Store,      iconColor: C.accent, iconBg: C.accentD, label: 'Магазины',     value: fmt(s.bizCount),      sub: `${fmt(s.activeCampaigns)} с кампаниями`,subColor: C.t3,     spark: genSpark(s.bizCount || 50) },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: -0.5 }}>Дашборд</h1>
        <div style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>Общая статистика платформы</div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 14, marginBottom: 24,
      }}>
        {CARDS.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        {/* Pending withdrawals */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>Ожидают выплаты</div>
              <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>{wds.length} заявок</div>
            </div>
            {wds.length > 0 && (
              <div style={{ background: C.orangeD, border: `1px solid ${C.orange}30`, borderRadius: 8, padding: '4px 10px', fontSize: 12, color: C.orange, fontWeight: 700 }}>
                {wds.length} pending
              </div>
            )}
          </div>
          {wds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: C.t3, fontSize: 13 }}>
              <CheckCircle size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
              Нет ожидающих выплат
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['ID', 'Пользователь', 'Сумма', 'Карта', 'Дата'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0 0 10px', color: C.t3, fontWeight: 600, fontSize: 11, letterSpacing: 0.3 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wds.slice(0, 6).map(w => (
                  <tr key={w.id}>
                    <td style={{ padding: '8px 0', color: C.t3 }}>#{w.id}</td>
                    <td style={{ padding: '8px 0', color: C.t1 }}>{w.users?.username ? `@${w.users.username}` : `#${w.users?.telegram_id || '—'}`}</td>
                    <td style={{ padding: '8px 0', color: C.gold, fontWeight: 600 }}>{fmt(w.amount)} GEO</td>
                    <td style={{ padding: '8px 0', color: C.t2 }}>{w.phone ? `****${String(w.phone).slice(-4)}` : '—'}</td>
                    <td style={{ padding: '8px 0', color: C.t3 }}>{fmtDate(w.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Audit log */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, marginBottom: 4 }}>Последние действия</div>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 14 }}>Audit log</div>
          {audit.map((item, i) => <ActivityRow key={i} item={item} />)}
          {audit.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: C.t3, fontSize: 13 }}>
              <Clock size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
              Нет записей
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
