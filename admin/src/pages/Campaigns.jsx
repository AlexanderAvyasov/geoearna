import React, { useEffect, useState } from 'react';
import { ToggleLeft, ToggleRight, RefreshCw, Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt, fmtDate } from '../lib/design.js';

export default function Campaigns() {
  const [camps,   setCamps]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(null);

  function load() {
    setLoading(true);
    api.get('/api/superadmin/campaigns')
      .then(r => r.ok ? r.json() : { campaigns: [] })
      .then(d => setCamps(d.campaigns || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function toggle(id) {
    setBusy(id);
    await api.post(`/api/superadmin/campaigns/${id}/toggle`, {});
    setBusy(null); load();
  }

  const active   = camps.filter(c => c.active).length;
  const inactive = camps.length - active;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Кампании</h1>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>
            <span style={{ color: C.green }}>{active} активных</span>
            <span style={{ margin: '0 6px', color: C.t3 }}>·</span>
            <span>{inactive} неактивных</span>
          </div>
        </div>
        <button onClick={load} style={{ padding: '8px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['ID', 'Бизнес', 'Тип задачи', 'Награда', 'Визиты', 'Заполнение', 'Статус', 'Вкл/Выкл'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.t3, fontWeight: 600, fontSize: 11, letterSpacing: 0.3 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center' }}>
                <Loader2 size={22} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
              </td></tr>
            )}
            {!loading && camps.map(c => {
              const fillPct = c.max_visits > 0 ? Math.round(c.visits_count / c.max_visits * 100) : 0;
              return (
                <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px', color: C.t3 }}>#{c.id}</td>
                  <td style={{ padding: '12px 16px', color: C.t1, fontWeight: 600 }}>{c.business_name || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.blue, background: C.blueD, borderRadius: 6, padding: '2px 8px' }}>
                      {c.task_type || 'visit'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: C.gold, fontWeight: 700 }}>{fmt(c.reward_amount)} GEO</td>
                  <td style={{ padding: '12px 16px', color: C.t2 }}>{fmt(c.visits_count)} / {fmt(c.max_visits)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', width: 80 }}>
                        <div style={{ height: '100%', width: `${fillPct}%`, background: fillPct > 90 ? C.red : fillPct > 60 ? C.orange : C.green, borderRadius: 2, transition: 'width 0.4s' }} />
                      </div>
                      <span style={{ fontSize: 11, color: C.t3, width: 36 }}>{fillPct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.active ? C.green : C.t3, background: c.active ? C.greenD : 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '2px 8px', border: `1px solid ${c.active ? C.green + '25' : C.border}` }}>
                      {c.active ? 'Активна' : 'Выкл'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => toggle(c.id)} disabled={busy === c.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.active ? C.green : C.t3 }}>
                      {busy === c.id
                        ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                        : c.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />
                      }
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && camps.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: C.t3 }}>Нет кампаний</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
