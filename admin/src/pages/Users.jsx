import React, { useEffect, useState } from 'react';
import { Search, Ban, UserCheck, X, ChevronDown, Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt, fmtDate } from '../lib/design.js';

function Badge({ color, bg, children }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, borderRadius: 6, padding: '2px 8px', border: `1px solid ${color}30` }}>
      {children}
    </span>
  );
}

function UserModal({ user, onClose, onRefresh }) {
  const [card,    setCard]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [adjAmt,  setAdjAmt]  = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState('');

  useEffect(() => {
    api.get(`/api/superadmin/users/${user.id}/card`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setCard(d))
      .finally(() => setLoading(false));
  }, [user.id]);

  async function ban() {
    if (!confirm(`Забанить @${user.username || user.telegram_id}?`)) return;
    setBusy(true);
    await api.post(`/api/superadmin/users/${user.id}/ban`, { reason: '' });
    setBusy(false); setMsg('Пользователь заблокирован'); onRefresh();
  }

  async function unban() {
    setBusy(true);
    await api.post(`/api/superadmin/users/${user.id}/unban`, {});
    setBusy(false); setMsg('Пользователь разблокирован'); onRefresh();
  }

  async function adjust() {
    const amount = Number(adjAmt);
    if (!Number.isFinite(amount) || !adjNote.trim()) return;
    setBusy(true);
    await api.post(`/api/superadmin/users/${user.id}/adjust`, { amount, note: adjNote });
    setBusy(false); setMsg(`GEO ${amount > 0 ? '+' : ''}${amount} применено`);
    setAdjAmt(''); setAdjNote('');
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 500, maxHeight: '85vh', overflowY: 'auto',
        background: C.surf, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '24px', zIndex: 101,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>
              {user.username ? `@${user.username}` : `#${user.telegram_id}`}
            </div>
            <div style={{ fontSize: 12, color: C.t3 }}>ID: {user.id}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3 }}><X size={18} /></button>
        </div>

        {msg && <div style={{ background: C.greenD, border: `1px solid ${C.green}30`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.green, marginBottom: 14 }}>{msg}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            ['Баланс', `${fmt(user.balance)} GEO`, C.gold],
            ['Визиты', fmt(card?.recentVisits?.length || user.visit_count), C.blue],
            ['Telegram ID', user.telegram_id, C.t2],
            ['Зарегистрирован', fmtDate(user.created_at), C.t3],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: C.card, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.t3, marginBottom: 4, fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* GEO adjustment */}
        <div style={{ background: C.card, borderRadius: 10, padding: '14px', marginBottom: 14, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, color: C.t2, fontWeight: 600, marginBottom: 10 }}>Корректировка GEO</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={adjAmt} onChange={e => setAdjAmt(e.target.value)} placeholder="+100 или -50"
              style={{ flex: 1, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.t1, fontSize: 13 }} />
            <input value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="Причина"
              style={{ flex: 2, background: C.surf, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.t1, fontSize: 13 }} />
          </div>
          <button onClick={adjust} disabled={busy || !adjAmt || !adjNote.trim()}
            style={{ padding: '8px 16px', background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 8, color: C.accent, fontSize: 13, fontWeight: 600 }}>
            Применить
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {user.banned_at ? (
            <button onClick={unban} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: C.greenD, border: `1px solid ${C.green}30`, borderRadius: 10, color: C.green, fontSize: 13, fontWeight: 600 }}>
              <UserCheck size={15} /> Разблокировать
            </button>
          ) : (
            <button onClick={ban} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: C.redD, border: `1px solid ${C.red}30`, borderRadius: 10, color: C.red, fontSize: 13, fontWeight: 600 }}>
              <Ban size={15} /> Заблокировать
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default function Users() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [sel,     setSel]     = useState(null);

  function load() {
    setLoading(true);
    api.get('/api/superadmin/users')
      .then(r => r.ok ? r.json() : { users: [] })
      .then(d => setUsers(d.users || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || String(u.telegram_id).includes(q) || (u.username || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Пользователи</h1>
          <div style={{ fontSize: 13, color: C.t3 }}>{fmt(users.length)} всего</div>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.t3 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по ID / @username"
            style={{ paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 13, width: 240 }} />
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Пользователь', 'Telegram ID', 'Баланс', 'Визиты', 'Зарегистрирован', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.t3, fontWeight: 600, fontSize: 11, letterSpacing: 0.3 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: C.t3 }}>
                <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
              </td></tr>
            )}
            {!loading && filtered.map(u => (
              <tr key={u.id}
                onClick={() => setSel(u)}
                style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.cardHov; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accentD, border: `1px solid ${C.accentGl}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.accent }}>
                      {(u.username || '?')[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600, color: u.banned_at ? C.red : C.t1 }}>{u.username ? `@${u.username}` : '—'}</span>
                  {u.banned_at && <span style={{ fontSize: 10, fontWeight: 700, color: C.red, background: C.redD, borderRadius: 4, padding: '1px 5px', border: `1px solid ${C.red}25` }}>БАН</span>}
                  </div>
                </td>
                <td style={{ padding: '12px 16px', color: C.t2 }}>{u.telegram_id}</td>
                <td style={{ padding: '12px 16px', color: C.gold, fontWeight: 600 }}>{fmt(u.balance)} GEO</td>
                <td style={{ padding: '12px 16px', color: C.t2 }}>{fmt(u.visit_count)}</td>
                <td style={{ padding: '12px 16px', color: C.t3 }}>{fmtDate(u.created_at)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <ChevronDown size={14} color={C.t3} style={{ transform: 'rotate(-90deg)' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && <UserModal user={sel} onClose={() => setSel(null)} onRefresh={load} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
