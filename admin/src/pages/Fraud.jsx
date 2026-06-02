import React, { useEffect, useState } from 'react';
import { ShieldAlert, Ban, RefreshCw, Loader2, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt, fmtDate } from '../lib/design.js';

export default function Fraud() {
  const [suspects, setSuspects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState({});
  const [msg,      setMsg]      = useState('');

  function load() {
    setLoading(true);
    api.get('/api/superadmin/fraud')
      .then(r => r.ok ? r.json() : { suspects: [] })
      .then(d => setSuspects(d.suspects || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function ban(userId, username) {
    if (!confirm(`Забанить ${username || `ID ${userId}`}?`)) return;
    setBusy(b => ({ ...b, [userId]: true }));
    await api.post(`/api/superadmin/users/${userId}/ban`, { reason: 'Fraud: подозрительная активность' });
    setSuspects(s => s.filter(u => u.db_id !== userId));
    setMsg('Пользователь заблокирован');
    setBusy(b => ({ ...b, [userId]: false }));
  }

  const flagColor = { HIGH: C.red, MEDIUM: C.gold };
  const flagLabel = { HIGH: 'ВЫСОКИЙ', MEDIUM: 'СРЕДНИЙ' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Антифрод</h1>
          <div style={{ fontSize: 13, color: C.t3 }}>{suspects.length} подозрительных</div>
        </div>
        <button onClick={load} style={{ padding: '8px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ background: `${C.red}10`, border: `1.5px solid ${C.red}30`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10 }}>
        <ShieldAlert size={18} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.red, marginBottom: 2 }}>Антифрод — приоритет #1</div>
          <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.5 }}>
            Пользователи, посетившие 3+ разных заведений за 24ч или сделавшие 5+ визитов. Алгоритм обнаружения на основе паттернов.
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ background: C.greenD, border: `1px solid ${C.green}30`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.green, marginBottom: 14 }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader2 size={22} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}
        {!loading && suspects.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.t3 }}>
            <ShieldAlert size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
            Подозрительных активностей не обнаружено
          </div>
        )}
        {!loading && suspects.map(s => (
          <div key={s.user_id || s.db_id} style={{
            background: C.card,
            border: `1.5px solid ${s.flag === 'HIGH' ? `${C.red}50` : `${C.gold}40`}`,
            borderRadius: 14, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.t1, marginBottom: 6 }}>
                  {s.username ? `@${s.username}` : `tg: ${s.telegram_id || s.user_id}`}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {s.flag && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: flagColor[s.flag] || C.red, background: `${flagColor[s.flag] || C.red}14`, borderRadius: 6, padding: '2px 8px', border: `1px solid ${flagColor[s.flag] || C.red}30` }}>
                      {flagLabel[s.flag] || s.flag}
                    </span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.orange, background: `${C.orange}14`, borderRadius: 6, padding: '2px 8px' }}>
                    {s.distinctBiz24h} заведений
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: `${C.blue}14`, borderRadius: 6, padding: '2px 8px' }}>
                    {s.visitCount24h} визитов
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.green }}>+{fmt(s.totalGeo24h)}</div>
                <div style={{ fontSize: 11, color: C.t3 }}>GEO за 24ч</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.t3, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} color={C.t3} />
              Последний визит: {fmtDate(s.lastVisit)}
            </div>
            <button
              onClick={() => ban(s.db_id, s.username)}
              disabled={busy[s.db_id]}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 16px', background: C.redD, border: `1px solid ${C.red}30`, borderRadius: 8, color: C.red, fontSize: 13, fontWeight: 600, width: '100%', cursor: 'pointer' }}
            >
              {busy[s.db_id]
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Ban size={13} />
              }
              Забанить
            </button>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
