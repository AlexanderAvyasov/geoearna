import React, { useEffect, useState } from 'react';
import { Check, X, Filter, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt, fmtDate } from '../lib/design.js';

const STATUS_CFG = {
  pending:  { label: 'Ожидание', color: C.orange, bg: C.orangeD },
  approved: { label: 'Одобрено', color: C.green,  bg: C.greenD  },
  rejected: { label: 'Отклонено',color: C.red,    bg: C.redD    },
};

export default function Withdrawals() {
  const [wds,     setWds]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('pending');
  const [busy,    setBusy]    = useState(null);
  const [msg,     setMsg]     = useState('');

  function load(status = filter) {
    setLoading(true);
    api.get(`/api/superadmin/withdrawals${status !== 'all' ? `?status=${status}` : ''}`)
      .then(r => r.ok ? r.json() : { withdrawals: [] })
      .then(d => setWds(d.withdrawals || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(filter); }, [filter]);

  async function approve(id) {
    if (!confirm('Одобрить выплату?')) return;
    setBusy(id);
    const r = await api.post(`/api/superadmin/withdrawals/${id}/approve`, {});
    if (r.ok) { setMsg('Выплата одобрена'); load(); } else { setMsg('Ошибка'); }
    setBusy(null);
  }

  async function reject(id) {
    const note = prompt('Причина отклонения (необязательно):') ?? '';
    setBusy(id);
    const r = await api.post(`/api/superadmin/withdrawals/${id}/reject`, { note });
    if (r.ok) { setMsg('Выплата отклонена'); load(); } else { setMsg('Ошибка'); }
    setBusy(null);
  }

  const cfg = STATUS_CFG;
  const pending = wds.filter(w => w.status === 'pending');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Выплаты</h1>
          {filter === 'pending' && pending.length > 0 && (
            <div style={{ fontSize: 13, color: C.orange, marginTop: 2 }}>
              {pending.length} ожидают подтверждения
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['pending', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: filter === s ? cfg[s].bg : C.card,
                border: `1px solid ${filter === s ? cfg[s].color + '40' : C.border}`,
                color: filter === s ? cfg[s].color : C.t3,
              }}>
              {cfg[s].label}
            </button>
          ))}
          <button onClick={() => load(filter)} style={{ padding: '7px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ background: C.greenD, border: `1px solid ${C.green}30`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.green, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
          {msg}
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: C.green }}><X size={14} /></button>
        </div>
      )}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['ID', 'Пользователь', 'Сумма GEO', 'Карта', 'Дата', 'Статус', 'Действия'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.t3, fontWeight: 600, fontSize: 11, letterSpacing: 0.3 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center' }}>
                <Loader2 size={22} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
              </td></tr>
            )}
            {!loading && wds.map(w => {
              const s = cfg[w.status] || cfg.pending;
              const user = w.users;
              return (
                <tr key={w.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px', color: C.t3 }}>#{w.id}</td>
                  <td style={{ padding: '12px 16px', color: C.t1, fontWeight: 600 }}>
                    {user?.username ? `@${user.username}` : `#${user?.telegram_id || '—'}`}
                  </td>
                  <td style={{ padding: '12px 16px', color: C.gold, fontWeight: 700 }}>{fmt(w.amount)}</td>
                  <td style={{ padding: '12px 16px', color: C.t2 }}>{w.phone ? `****${String(w.phone).slice(-4)}` : '—'}</td>
                  <td style={{ padding: '12px 16px', color: C.t3 }}>{fmtDate(w.created_at)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, borderRadius: 6, padding: '3px 8px', border: `1px solid ${s.color}25` }}>
                      {s.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {w.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => approve(w.id)} disabled={busy === w.id}
                          style={{ padding: '5px 10px', background: C.greenD, border: `1px solid ${C.green}30`, borderRadius: 7, color: C.green, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Check size={13} /> Одобрить
                        </button>
                        <button onClick={() => reject(w.id)} disabled={busy === w.id}
                          style={{ padding: '5px 10px', background: C.redD, border: `1px solid ${C.red}30`, borderRadius: 7, color: C.red, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <X size={13} /> Отклонить
                        </button>
                      </div>
                    )}
                    {w.status !== 'pending' && w.note && (
                      <span style={{ fontSize: 12, color: C.t3 }}>{w.note}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && wds.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: C.t3, fontSize: 13 }}>
                Нет заявок
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
