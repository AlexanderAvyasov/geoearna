import React, { useEffect, useState } from 'react';
import { Store, CheckCircle, PauseCircle, PlayCircle, RefreshCw, Loader2, Search, Wallet, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt, fmtDate } from '../lib/design.js';

export default function Businesses() {
  const [businesses, setBusinesses] = useState([]);
  const [topups,     setTopups]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [busy,       setBusy]       = useState({});
  const [msg,        setMsg]        = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/api/superadmin/businesses').then(r => r.ok ? r.json() : { businesses: [] }),
      api.get('/api/superadmin/topups').then(r => r.ok ? r.json() : { topups: [] }),
    ]).then(([b, t]) => {
      setBusinesses(b.businesses || []);
      setTopups(t.topups || []);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function confirmTopup(id) {
    setBusy(b => ({ ...b, [id]: 'topup' }));
    const r = await api.post(`/api/superadmin/topups/${id}/confirm`, {});
    if (r.ok) {
      setMsg('Пополнение подтверждено');
      setTopups(t => t.map(tp => tp.id === id ? { ...tp, status: 'confirmed' } : tp));
    }
    setBusy(b => ({ ...b, [id]: null }));
  }

  async function suspend(biz) {
    if (!confirm(`Заморозить "${biz.name}"?`)) return;
    setBusy(b => ({ ...b, [biz.id]: 'suspend' }));
    await api.post(`/api/superadmin/businesses/${biz.id}/suspend`, { reason: 'Admin action' });
    setBusinesses(bs => bs.map(b => b.id === biz.id ? { ...b, suspended_at: new Date().toISOString() } : b));
    setBusy(b => ({ ...b, [biz.id]: null }));
  }

  async function unsuspend(bizId) {
    setBusy(b => ({ ...b, [bizId]: 'unsuspend' }));
    await api.post(`/api/superadmin/businesses/${bizId}/unsuspend`, {});
    setBusinesses(bs => bs.map(b => b.id === bizId ? { ...b, suspended_at: null } : b));
    setBusy(b => ({ ...b, [bizId]: null }));
  }

  const pendingTopups = topups.filter(t => t.status === 'pending');
  const q = search.toLowerCase();
  const filtered = q
    ? businesses.filter(b =>
        b.name?.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q) ||
        String(b.owner_telegram_id).includes(q)
      )
    : businesses;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Заведения</h1>
          <div style={{ fontSize: 13, color: C.t3 }}>
            {businesses.length} всего
            {pendingTopups.length > 0 && (
              <span style={{ marginLeft: 8, color: C.gold, fontWeight: 700 }}>· {pendingTopups.length} пополнений</span>
            )}
          </div>
        </div>
        <button onClick={load} style={{ padding: '8px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {msg && (
        <div style={{ background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.accent, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
          {msg}
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {/* Pending topups */}
      {!loading && pendingTopups.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wallet size={12} color={C.gold} />
            Пополнения ({pendingTopups.length})
          </div>
          {pendingTopups.map(t => (
            <div key={t.id} style={{ background: C.card, border: `1.5px solid ${C.gold}50`, borderRadius: 14, padding: '14px 16px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: C.gold }}>{fmt(t.amount)} GEO</div>
                  <div style={{ fontSize: 12, color: C.t3 }}>{t.businesses?.name} · {fmtDate(t.created_at)}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.orange, background: C.orangeD, borderRadius: 6, padding: '2px 8px', border: `1px solid ${C.orange}30` }}>
                  Ожидает
                </span>
              </div>
              <button
                onClick={() => confirmTopup(t.id)}
                disabled={busy[t.id] === 'topup'}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', width: '100%', background: C.goldD, border: `1px solid ${C.gold}30`, borderRadius: 8, color: C.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {busy[t.id] === 'topup'
                  ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : <CheckCircle size={14} />
                }
                Подтвердить зачисление
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.t3 }} />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Поиск по названию, адресу, Telegram ID..."
          style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.t1, fontSize: 13 }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader2 size={22} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.t3 }}>
            <Store size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
            Нет заведений
          </div>
        )}
        {!loading && filtered.map(b => {
          const isSuspended = !!b.suspended_at;
          const activeCamp  = b.campaigns?.find(c => c.active);
          return (
            <div key={b.id} style={{
              background: isSuspended ? `${C.red}06` : C.card,
              border: `1px solid ${isSuspended ? `${C.red}40` : C.border}`,
              borderRadius: 14, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: C.t1 }}>{b.name}</div>
                    {isSuspended && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: C.redD, borderRadius: 6, padding: '2px 8px', border: `1px solid ${C.red}25` }}>
                        ЗАМОРОЖЕН
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.t3 }}>
                    {b.address || '—'} · tg:{b.owner_telegram_id} · {b.campaigns?.length || 0} кампаний
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 17, color: b.balance > 0 ? C.t1 : C.t3 }}>{fmt(b.balance)}</div>
                  <div style={{ fontSize: 10, color: C.t3 }}>GEO</div>
                </div>
              </div>

              {activeCamp && (
                <div style={{ background: C.greenD, border: `1px solid ${C.green}30`, borderRadius: 10, padding: '7px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{activeCamp.visits_count}/{activeCamp.max_visits} визитов</span>
                  <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>+{fmt(activeCamp.reward_amount)} GEO/визит</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                {isSuspended ? (
                  <button
                    onClick={() => unsuspend(b.id)}
                    disabled={busy[b.id] === 'unsuspend'}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: C.greenD, border: `1px solid ${C.green}30`, borderRadius: 8, color: C.green, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {busy[b.id] === 'unsuspend' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <PlayCircle size={13} />}
                    Восстановить
                  </button>
                ) : (
                  <button
                    onClick={() => suspend(b)}
                    disabled={busy[b.id] === 'suspend'}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: C.redD, border: `1px solid ${C.red}30`, borderRadius: 8, color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {busy[b.id] === 'suspend' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <PauseCircle size={13} />}
                    Заморозить
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
