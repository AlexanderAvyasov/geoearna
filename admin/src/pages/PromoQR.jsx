import React, { useEffect, useState } from 'react';
import {
  Plus, ToggleLeft, ToggleRight, Trash2, X, Loader2, QrCode,
  BarChart3, Users, Clock, MapPin, RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt, fmtDate } from '../lib/design.js';

const RARITIES = ['common', 'rare', 'epic', 'legendary'];
const R_CFG = {
  common:    { label: 'COMMON',    color: '#9CA3AF' },
  rare:      { label: 'RARE',      color: '#60A5FA' },
  epic:      { label: 'EPIC',      color: '#C084FC' },
  legendary: { label: 'LEGENDARY', color: '#FBBF24' },
};

// ── Create modal ──────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', reward_amount: 10, max_claims: 100, rarity: 'common',
    lat: '', lng: '', radius_m: 200, expires_at: '', cooldown_hours: 0,
  });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function submit() {
    if (!form.title.trim() || !form.lat || !form.lng) { setErr('Заполните обязательные поля'); return; }
    setBusy(true); setErr('');
    const body = {
      ...form,
      lat: parseFloat(form.lat), lng: parseFloat(form.lng),
      reward_amount: Number(form.reward_amount),
      max_claims: Number(form.max_claims),
      radius_m: Number(form.radius_m),
      cooldown_hours: Number(form.cooldown_hours),
      expires_at: form.expires_at || null,
    };
    const r = await api.post('/api/superadmin/promo-campaigns', body);
    if (r.ok) { onCreated(); onClose(); }
    else { const d = await r.json().catch(() => ({})); setErr(d.error || 'Ошибка'); }
    setBusy(false);
  }

  const inp = (label, key, type = 'text') => (
    <div key={key}>
      <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 5 }}>{label}</div>
      <input type={type} value={form[key]} onChange={e => set(key, e.target.value)}
        style={{ width: '100%', padding: '9px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t1, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 480, maxHeight: '90vh', overflowY: 'auto',
        background: C.surf, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '24px', zIndex: 101,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Новая Promo QR</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {inp('Название *', 'title')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {inp('Награда GEO *', 'reward_amount', 'number')}
            {inp('Макс. получений *', 'max_claims', 'number')}
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 5 }}>Редкость</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {RARITIES.map(r => (
                <button key={r} onClick={() => set('rarity', r)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  color: R_CFG[r].color,
                  background: form.rarity === r ? `${R_CFG[r].color}18` : C.bg,
                  border: `1px solid ${form.rarity === r ? R_CFG[r].color + '40' : C.border}`,
                }}>{R_CFG[r].label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {inp('Широта *', 'lat', 'number')}
            {inp('Долгота *', 'lng', 'number')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {inp('Радиус (м)', 'radius_m', 'number')}
            {inp('Cooldown (часы)', 'cooldown_hours', 'number')}
          </div>
          {inp('Истекает', 'expires_at', 'datetime-local')}
        </div>

        {err && <div style={{ color: C.red, fontSize: 13, marginTop: 12 }}>{err}</div>}

        <button onClick={submit} disabled={busy}
          style={{ marginTop: 20, width: '100%', padding: '12px', background: C.accent, border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#07101C', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
          {busy && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
          Создать
        </button>
      </div>
    </>
  );
}

// ── Analytics modal ───────────────────────────────────────────────────────────

function AnalyticsModal({ campaign, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const rc = R_CFG[campaign.rarity] || R_CFG.common;

  useEffect(() => {
    api.get(`/api/superadmin/promo-campaigns/${campaign.id}/analytics`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [campaign.id]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 520, maxHeight: '88vh', overflowY: 'auto',
        background: C.surf, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '24px', zIndex: 101,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>{campaign.title}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: rc.color, background: `${rc.color}14`, borderRadius: 6, padding: '2px 8px', border: `1px solid ${rc.color}25` }}>
                {rc.label}
              </span>
              <span style={{ fontSize: 11, color: C.t3 }}>ID: {campaign.id}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader2 size={22} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        ) : !data ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: C.t3 }}>Нет данных</div>
        ) : (
          <>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                ['Клеймов', data.totalClaims ?? campaign.claims_count, C.accent, BarChart3],
                ['Уников', data.uniqueUsers, C.blue, Users],
                ['Последний', data.lastClaimAt ? fmtDate(data.lastClaimAt).split(',')[0] : '—', C.t3, Clock],
              ].map(([label, val, color, Icon]) => (
                <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <Icon size={14} color={color} style={{ margin: '0 auto 6px', display: 'block' }} />
                  <div style={{ fontSize: 20, fontWeight: 700, color, letterSpacing: -0.5 }}>{val}</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Location */}
            {(campaign.lat || data.lat) && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={14} color={C.t3} />
                <div>
                  <div style={{ fontSize: 12, color: C.t3, marginBottom: 2 }}>Местоположение</div>
                  <div style={{ fontSize: 13, color: C.t1, fontFamily: 'monospace' }}>
                    {(data.lat || campaign.lat)?.toFixed(6)}, {(data.lng || campaign.lng)?.toFixed(6)}
                  </div>
                </div>
              </div>
            )}

            {/* Recent claims */}
            {data.claims?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                  Последние клеймы
                </div>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  {data.claims.slice(0, 15).map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < Math.min(data.claims.length, 15) - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
                          {c.users?.username ? `@${c.users.username}` : `#${c.users?.telegram_id || '—'}`}
                        </div>
                        <div style={{ fontSize: 11, color: C.t3 }}>{fmtDate(c.claimed_at)}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: rc.color }}>+{fmt(c.reward_amount || campaign.reward_amount)} GEO</div>
                    </div>
                  ))}
                </div>
                {data.claims.length > 15 && (
                  <div style={{ textAlign: 'center', fontSize: 12, color: C.t3, marginTop: 8 }}>
                    и ещё {data.claims.length - 15}...
                  </div>
                )}
              </div>
            )}

            {!data.claims?.length && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: C.t3, fontSize: 13 }}>
                <QrCode size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
                Клеймов ещё нет
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PromoQR() {
  const [promos,    setPromos]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState(null);
  const [create,    setCreate]    = useState(false);
  const [analytics, setAnalytics] = useState(null);

  function load() {
    setLoading(true);
    api.get('/api/superadmin/promo-campaigns')
      .then(r => r.ok ? r.json() : { campaigns: [] })
      .then(d => setPromos(d.campaigns || []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function toggle(id, active) {
    setBusy(id);
    await api.patch(`/api/superadmin/promo-campaigns/${id}`, { active: !active });
    setBusy(null); load();
  }

  async function del(id, title) {
    if (!confirm(`Удалить «${title}»?`)) return;
    setBusy(id);
    await api.delete(`/api/superadmin/promo-campaigns/${id}`);
    setBusy(null); load();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Promo QR</h1>
          <div style={{ fontSize: 13, color: C.t3 }}>{promos.filter(p => p.active).length} активных</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '8px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3 }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: C.accent, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: '#07101C', cursor: 'pointer' }}>
            <Plus size={15} /> Создать
          </button>
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Название', 'Редкость', 'Награда', 'Использований', 'Радиус', 'Истекает', 'Статус', ''].map(h => (
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
            {!loading && promos.map(p => {
              const rc = R_CFG[p.rarity] || R_CFG.common;
              const fillPct = p.max_claims > 0 ? Math.round(p.claims_count / p.max_claims * 100) : 0;
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.cardHov; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: C.t1 }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: C.t3 }}>ID: {p.id}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: rc.color, background: `${rc.color}14`, borderRadius: 6, padding: '2px 8px', border: `1px solid ${rc.color}25` }}>
                      {rc.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: C.gold, fontWeight: 700 }}>{fmt(p.reward_amount)} GEO</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${fillPct}%`, background: fillPct > 90 ? C.red : C.green, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 12, color: C.t2 }}>{p.claims_count}/{p.max_claims}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: C.t2 }}>{p.radius_m}м</td>
                  <td style={{ padding: '12px 16px', color: C.t3, fontSize: 12 }}>{p.expires_at ? fmtDate(p.expires_at) : '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: p.active ? C.green : C.t3, background: p.active ? C.greenD : 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '2px 8px', border: `1px solid ${p.active ? C.green + '25' : C.border}` }}>
                      {p.active ? 'Активна' : 'Выкл'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setAnalytics(p)}
                        title="Аналитика"
                        style={{ background: 'none', border: 'none', color: C.blue, cursor: 'pointer', padding: '2px 4px' }}
                      >
                        <BarChart3 size={15} />
                      </button>
                      <button onClick={() => toggle(p.id, p.active)} disabled={busy === p.id}
                        style={{ background: 'none', border: 'none', color: p.active ? C.green : C.t3, cursor: 'pointer' }}>
                        {p.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      <button onClick={() => del(p.id, p.title)} disabled={busy === p.id}
                        style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer' }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && promos.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: C.t3 }}>
                <QrCode size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
                Нет Promo QR кампаний
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {create    && <CreateModal onClose={() => setCreate(false)} onCreated={load} />}
      {analytics && <AnalyticsModal campaign={analytics} onClose={() => setAnalytics(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
