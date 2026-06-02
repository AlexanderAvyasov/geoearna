import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, X, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmtDate } from '../lib/design.js';

function ReplyModal({ msg, onClose, onDone }) {
  const [reply, setReply] = useState('');
  const [busy,  setBusy]  = useState(false);

  async function send() {
    if (!reply.trim()) return;
    setBusy(true);
    const r = await api.post(`/api/superadmin/support/${msg.id}/reply`, { reply: reply.trim() });
    if (r.ok) { onDone(); onClose(); }
    setBusy(false);
  }

  async function close() {
    await api.post(`/api/superadmin/support/${msg.id}/close`, {});
    onDone(); onClose();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 480, background: C.surf, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '24px', zIndex: 101,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>
            {msg.users?.username ? `@${msg.users.username}` : `#${msg.users?.telegram_id}`}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3 }}><X size={18} /></button>
        </div>

        <div style={{ background: C.card, borderRadius: 10, padding: '12px 14px', marginBottom: 14, fontSize: 13, color: C.t1, lineHeight: 1.55 }}>
          <div style={{ fontSize: 10, color: C.t3, fontWeight: 600, marginBottom: 6 }}>{msg.type?.toUpperCase()} · {fmtDate(msg.created_at)}</div>
          {msg.message}
        </div>

        <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Ответ пользователю..."
          rows={4}
          style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 13, resize: 'vertical', marginBottom: 12 }} />

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={send} disabled={busy || !reply.trim()}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 8, color: C.accent, fontSize: 13, fontWeight: 700 }}>
            {busy ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            Ответить
          </button>
          <button onClick={close}
            style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3, fontSize: 13 }}>
            Закрыть тикет
          </button>
        </div>
      </div>
    </>
  );
}

export default function Support() {
  const [tickets,  setTickets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('open');
  const [selected, setSelected] = useState(null);

  function load(status = filter) {
    setLoading(true);
    api.get(`/api/superadmin/support?status=${status}`)
      .then(r => r.ok ? r.json() : { messages: [] })
      .then(d => setTickets(d.messages || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(filter); }, [filter]);

  const TYPE_CFG = {
    support: { label: 'Поддержка', color: C.blue   },
    report:  { label: 'Жалоба',   color: C.red     },
    other:   { label: 'Прочее',   color: C.t3      },
  };

  const STATUS_CFG = {
    open:    { label: 'Открыт',   color: C.orange },
    replied: { label: 'Отвечен',  color: C.green  },
    closed:  { label: 'Закрыт',   color: C.t3     },
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Поддержка</h1>
          <div style={{ fontSize: 13, color: C.t3 }}>{tickets.length} тикетов</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['open', 'replied', 'closed'].map(s => {
            const sc = STATUS_CFG[s];
            return (
              <button key={s} onClick={() => setFilter(s)}
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: filter === s ? `${sc.color}14` : C.card, border: `1px solid ${filter === s ? sc.color + '40' : C.border}`, color: filter === s ? sc.color : C.t3 }}>
                {sc.label}
              </button>
            );
          })}
          <button onClick={() => load(filter)} style={{ padding: '7px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader2 size={22} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}
        {!loading && tickets.map(t => {
          const tc = TYPE_CFG[t.type]   || TYPE_CFG.other;
          const sc = STATUS_CFG[t.status] || STATUS_CFG.open;
          return (
            <div key={t.id}
              onClick={() => setSelected(t)}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.14s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.border2; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tc.color, background: `${tc.color}14`, borderRadius: 5, padding: '2px 7px', border: `1px solid ${tc.color}25` }}>
                    {tc.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
                    {t.users?.username ? `@${t.users.username}` : `#${t.users?.telegram_id}`}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: `${sc.color}14`, borderRadius: 5, padding: '2px 7px' }}>
                    {sc.label}
                  </span>
                  <span style={{ fontSize: 11, color: C.t3 }}>{fmtDate(t.created_at)}</span>
                </div>
              </div>
              <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.message}
              </div>
              {t.admin_reply && (
                <div style={{ fontSize: 12, color: C.accent, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle size={11} /> {t.admin_reply.slice(0, 80)}{t.admin_reply.length > 80 ? '…' : ''}
                </div>
              )}
            </div>
          );
        })}
        {!loading && tickets.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.t3 }}>
            <MessageSquare size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
            Нет тикетов
          </div>
        )}
      </div>

      {selected && <ReplyModal msg={selected} onClose={() => setSelected(null)} onDone={() => load(filter)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
