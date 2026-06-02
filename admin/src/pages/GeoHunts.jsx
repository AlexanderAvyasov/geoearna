import React, { useEffect, useState } from 'react';
import { ToggleLeft, ToggleRight, Loader2, Crosshair, RefreshCw } from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt, fmtDate } from '../lib/design.js';

export default function GeoHunts() {
  const [hunts,   setHunts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(null);

  function load() {
    setLoading(true);
    api.get('/api/sa/geohunts')
      .then(r => r.ok ? r.json() : { hunts: [] })
      .then(d => setHunts(d.hunts || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function toggle(id) {
    setBusy(id);
    await api.patch(`/api/sa/geohunts/${id}`, {});
    setBusy(null); load();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>GeoHunts</h1>
          <div style={{ fontSize: 13, color: C.t3 }}>{hunts.filter(h => h.active).length} активных</div>
        </div>
        <button onClick={load} style={{ padding: '8px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Название', 'Награда за код', 'Прогресс', 'Статус', 'Создан', 'Вкл/Выкл'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.t3, fontWeight: 600, fontSize: 11, letterSpacing: 0.3 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center' }}>
                <Loader2 size={22} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
              </td></tr>
            )}
            {!loading && hunts.map(h => {
              const pct = h.total_codes > 0 ? Math.round(h.claimed_codes / h.total_codes * 100) : 0;
              return (
                <tr key={h.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: C.t1 }}>{h.title}</div>
                    <div style={{ fontSize: 11, color: C.t3 }}>ID: {h.id?.slice(0, 8)}…</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: C.gold, fontWeight: 700 }}>{fmt(h.reward_per_code)} GEO</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? C.red : pct > 60 ? C.orange : C.green, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 12, color: C.t2 }}>{h.claimed_codes}/{h.total_codes}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: h.active ? C.green : C.t3, background: h.active ? C.greenD : 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '2px 8px', border: `1px solid ${h.active ? C.green + '25' : C.border}` }}>
                      {h.active ? 'Активен' : 'Остановлен'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: C.t3 }}>{fmtDate(h.created_at)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => toggle(h.id)} disabled={busy === h.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: h.active ? C.green : C.t3 }}>
                      {busy === h.id
                        ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                        : h.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />
                      }
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && hunts.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: C.t3 }}>
                <Crosshair size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
                Нет GeoHunts
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
