import React, { useEffect, useState } from 'react';
import { Check, X, Building2, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmtDate } from '../lib/design.js';

export default function BusinessApps() {
  const [apps,    setApps]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('pending');
  const [busy,    setBusy]    = useState(null);
  const [msg,     setMsg]     = useState('');

  function load(status = filter) {
    setLoading(true);
    api.get(`/api/superadmin/business-applications?status=${status}`)
      .then(r => r.ok ? r.json() : { applications: [] })
      .then(d => setApps(d.applications || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(filter); }, [filter]);

  async function approve(id) {
    setBusy(id);
    const r = await api.post(`/api/superadmin/business-applications/${id}/approve`, {});
    if (r.ok) { setMsg('Заявка одобрена'); load(); }
    else { const d = await r.json().catch(() => ({})); setMsg(d.error || 'Ошибка'); }
    setBusy(null);
  }

  async function reject(id) {
    const note = prompt('Причина отклонения:') ?? '';
    setBusy(id);
    const r = await api.post(`/api/superadmin/business-applications/${id}/reject`, { note });
    if (r.ok) { setMsg('Заявка отклонена'); load(); } else { setMsg('Ошибка'); }
    setBusy(null);
  }

  const STATUS_CFG = {
    pending:  { label: 'На рассмотрении', color: C.orange, bg: C.orangeD },
    approved: { label: 'Одобрено',        color: C.green,  bg: C.greenD  },
    rejected: { label: 'Отклонено',       color: C.red,    bg: C.redD    },
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Заявки на бизнес</h1>
          <div style={{ fontSize: 13, color: C.t3 }}>{apps.length} заявок</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['pending', 'approved', 'rejected'].map(s => {
            const sc = STATUS_CFG[s];
            return (
              <button key={s} onClick={() => setFilter(s)}
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: filter === s ? sc.bg : C.card, border: `1px solid ${filter === s ? sc.color + '40' : C.border}`, color: filter === s ? sc.color : C.t3 }}>
                {sc.label}
              </button>
            );
          })}
          <button onClick={() => load(filter)} style={{ padding: '7px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.accent, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
          {msg} <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: C.accent }}><X size={14} /></button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader2 size={22} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}
        {!loading && apps.map(a => {
          const sc = STATUS_CFG[a.status] || STATUS_CFG.pending;
          return (
            <div key={a.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: C.blueD, border: `1px solid ${C.blue}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={18} color={C.blue} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.t1 }}>{a.name}</div>
                    <div style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>{a.address}</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, borderRadius: 6, padding: '3px 8px', border: `1px solid ${sc.color}25` }}>
                  {sc.label}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                {[
                  ['Категория', a.category || '—'],
                  ['Телефон',   a.contact_phone || '—'],
                  ['Владелец',  a.users?.username ? `@${a.users.username}` : `#${a.owner_telegram_id}`],
                  ['Дата',      fmtDate(a.created_at)],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: C.surf, borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: C.t3, fontWeight: 600, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, color: C.t2 }}>{val}</div>
                  </div>
                ))}
              </div>

              {a.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => approve(a.id)} disabled={busy === a.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.greenD, border: `1px solid ${C.green}30`, borderRadius: 8, color: C.green, fontSize: 13, fontWeight: 600 }}>
                    <Check size={14} /> Одобрить
                  </button>
                  <button onClick={() => reject(a.id)} disabled={busy === a.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.redD, border: `1px solid ${C.red}30`, borderRadius: 8, color: C.red, fontSize: 13, fontWeight: 600 }}>
                    <X size={14} /> Отклонить
                  </button>
                </div>
              )}
              {a.review_note && <div style={{ fontSize: 12, color: C.t3, marginTop: 8 }}>Примечание: {a.review_note}</div>}
            </div>
          );
        })}
        {!loading && apps.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.t3 }}>
            <Building2 size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
            Нет заявок
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
