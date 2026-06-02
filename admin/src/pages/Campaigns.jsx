import React, { useEffect, useState } from 'react';
import {
  ToggleLeft, ToggleRight, RefreshCw, Loader2, Plus, Pencil,
  PauseCircle, PlayCircle, Check, X, Zap, CheckCircle, AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt, fmtDate } from '../lib/design.js';

// ── Edit campaign modal ───────────────────────────────────────────────────────

function EditModal({ campaign, onClose, onSaved }) {
  const [reward,  setReward]  = useState(String(campaign.reward_amount));
  const [visits,  setVisits]  = useState(String(campaign.max_visits));
  const [endsAt,  setEndsAt]  = useState(campaign.ends_at ? new Date(campaign.ends_at).toISOString().split('T')[0] : '');
  const [noEnd,   setNoEnd]   = useState(!campaign.ends_at);
  const [active,  setActive]  = useState(campaign.active);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const today = new Date().toISOString().split('T')[0];

  async function save() {
    setLoading(true); setError('');
    const body = {
      reward_amount: parseInt(reward, 10) || campaign.reward_amount,
      max_visits:    parseInt(visits, 10) || campaign.max_visits,
      active,
      ends_at: noEnd ? null : (endsAt ? new Date(endsAt + 'T23:59:59').toISOString() : campaign.ends_at),
    };
    const r = await api.patch(`/api/superadmin/campaigns/${campaign.id}`, body);
    if (r.ok) { onSaved(); }
    else { const d = await r.json().catch(() => ({})); setError(d.error || 'Ошибка сохранения'); }
    setLoading(false);
  }

  const inp = (label, val, setVal, type = 'text') => (
    <div>
      <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 5 }}>{label}</div>
      <input type={type} value={val} onChange={e => setVal(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t1, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 460, maxHeight: '90vh', overflowY: 'auto',
        background: C.surf, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '24px', zIndex: 101,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Редактировать кампанию</div>
            <div style={{ fontSize: 12, color: C.t3 }}>{campaign.business_name} · ID {campaign.id}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {inp('Награда GEO', reward, setReward, 'number')}
            {inp('Активаций', visits, setVisits, 'number')}
          </div>

          <div>
            <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 5 }}>Дата окончания</div>
            <div
              onClick={() => setNoEnd(v => !v)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer' }}
            >
              <span style={{ fontSize: 13, color: C.t2 }}>Без ограничения</span>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: noEnd ? C.accent : C.border, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: noEnd ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </div>
            </div>
            {!noEnd && (
              <input type="date" value={endsAt} min={today} onChange={e => setEndsAt(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t1, fontSize: 13, boxSizing: 'border-box', outline: 'none', colorScheme: 'dark' }} />
            )}
          </div>

          <div
            onClick={() => setActive(v => !v)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: active ? C.greenD : C.bg, border: `1px solid ${active ? C.green + '40' : C.border}`, borderRadius: 8, padding: '12px 14px', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: active ? C.green : C.t2 }}>{active ? 'Активна' : 'Остановлена'}</span>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: active ? C.green : C.border, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
            </div>
          </div>
        </div>

        {error && <div style={{ color: C.red, fontSize: 13, marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3, fontSize: 13, cursor: 'pointer' }}>
            Отмена
          </button>
          <button onClick={save} disabled={loading} style={{ flex: 2, padding: '10px', background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 8, color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
            Сохранить
          </button>
        </div>
      </div>
    </>
  );
}

// ── Platform campaign modal ───────────────────────────────────────────────────

function PlatformCampaignModal({ onClose, onCreated }) {
  const [businesses, setBusinesses] = useState([]);
  const [bizLoading, setBizLoading] = useState(true);
  const [bizId,      setBizId]      = useState('');
  const [reward,     setReward]     = useState('');
  const [visits,     setVisits]     = useState('');
  const [endsAt,     setEndsAt]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [result,     setResult]     = useState(null);
  const [walletBal,  setWalletBal]  = useState(null);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([
      api.get('/api/superadmin/businesses').then(r => r.ok ? r.json() : { businesses: [] }),
      api.get('/api/superadmin/overview').then(r => r.ok ? r.json() : null),
    ]).then(([b, o]) => {
      setBusinesses(b.businesses || []);
      if (o?.platformBalance != null) setWalletBal(o.platformBalance);
    }).finally(() => setBizLoading(false));
  }, []);

  const rewardNum = parseInt(reward, 10) || 0;
  const visitsNum = parseInt(visits, 10) || 0;
  const totalCost = rewardNum * visitsNum;
  const canAfford = walletBal !== null && totalCost <= walletBal && totalCost > 0;
  const canSubmit = bizId && rewardNum >= 1 && visitsNum >= 1 && canAfford;

  async function create() {
    if (!canSubmit) return;
    setLoading(true); setError('');
    const r = await api.post('/api/superadmin/platform-campaign', {
      business_id:   parseInt(bizId, 10),
      reward_amount: rewardNum,
      max_visits:    visitsNum,
      ends_at:       endsAt ? new Date(endsAt + 'T23:59:59').toISOString() : null,
    });
    if (r.ok) {
      const d = await r.json();
      setResult(d);
      onCreated();
    } else {
      const d = await r.json().catch(() => ({}));
      setError(d.error === 'INSUFFICIENT_PLATFORM_BALANCE'
        ? 'Недостаточно на кошельке платформы'
        : d.error || 'Ошибка создания');
    }
    setLoading(false);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 460, maxHeight: '90vh', overflowY: 'auto',
        background: C.surf, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '24px', zIndex: 101,
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Акция платформы</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: C.t3, marginBottom: 20 }}>
          Кошелёк: <strong style={{ color: C.accent }}>{walletBal !== null ? fmt(walletBal) : '...'} GEO</strong>
        </div>

        {result ? (
          <div>
            <div style={{ background: C.greenD, border: `1px solid ${C.green}30`, borderRadius: 14, padding: '20px', marginBottom: 16, textAlign: 'center' }}>
              <CheckCircle size={28} color={C.green} style={{ margin: '0 auto 10px', display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: 15, color: C.t1, marginBottom: 6 }}>Акция создана!</div>
              <div style={{ fontSize: 13, color: C.t3 }}>{result.business?.name}</div>
              {result.qrUrl && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: C.t3, marginBottom: 4 }}>QR-ссылка</div>
                  <div style={{ fontSize: 11, color: C.accent, wordBreak: 'break-all', fontFamily: 'monospace' }}>{result.qrUrl}</div>
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ width: '100%', padding: '11px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 10, color: C.t2, fontSize: 13, cursor: 'pointer' }}>
              Закрыть
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 5 }}>Заведение</div>
              {bizLoading ? (
                <div style={{ height: 40, background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }} />
              ) : (
                <select value={bizId} onChange={e => setBizId(e.target.value)}
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: bizId ? C.t1 : C.t3, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Выберите заведение...</option>
                  {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 5 }}>Награда (GEO)</div>
                <input value={reward} onChange={e => setReward(e.target.value.replace(/\D/g, ''))} placeholder="100" type="number"
                  style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t1, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 5 }}>Активаций</div>
                <input value={visits} onChange={e => setVisits(e.target.value.replace(/\D/g, ''))} placeholder="50" type="number"
                  style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t1, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
              </div>
            </div>

            {rewardNum > 0 && visitsNum > 0 && (
              <div style={{ background: canAfford ? C.accentD : C.redD, border: `1px solid ${canAfford ? C.accentGl : C.red + '30'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: canAfford ? C.accent : C.red }}>
                Итого: {fmt(totalCost)} GEO
                {!canAfford && walletBal !== null && ` (доступно: ${fmt(walletBal)})`}
              </div>
            )}

            <div>
              <div style={{ fontSize: 11, color: C.t3, fontWeight: 600, marginBottom: 5 }}>Дата окончания (необязательно)</div>
              <input type="date" value={endsAt} min={today} onChange={e => setEndsAt(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t1, fontSize: 13, boxSizing: 'border-box', outline: 'none', colorScheme: 'dark' }} />
            </div>

            {error && <div style={{ color: C.red, fontSize: 13 }}>{error}</div>}

            <button onClick={create} disabled={!canSubmit || loading}
              style={{ padding: '12px', background: canSubmit ? C.accentD : 'rgba(255,255,255,0.04)', border: `1px solid ${canSubmit ? C.accentGl : C.border}`, borderRadius: 10, color: canSubmit ? C.accent : C.t3, fontSize: 13, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
              {canSubmit ? `Создать · ${fmt(totalCost)} GEO` : 'Заполните форму'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Campaigns() {
  const [camps,        setCamps]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [busy,         setBusy]         = useState(null);
  const [filter,       setFilter]       = useState('all');
  const [editCampaign, setEditCampaign] = useState(null);
  const [showCreate,   setShowCreate]   = useState(false);

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

  const filtered = camps.filter(c =>
    filter === 'all'      ? true :
    filter === 'active'   ? c.active :
    filter === 'inactive' ? !c.active :
    filter === 'anomaly'  ? c.isAnomaly : true
  );
  const anomalies = camps.filter(c => c.isAnomaly && c.active);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Кампании</h1>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>
            <span style={{ color: C.green }}>{camps.filter(c => c.active).length} активных</span>
            <span style={{ margin: '0 6px', color: C.t3 }}>·</span>
            <span>{camps.length - camps.filter(c => c.active).length} неактивных</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 8, color: C.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={13} /> Акция платформы
          </button>
          <button onClick={load} style={{ padding: '8px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3 }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Anomaly alert */}
      {!loading && anomalies.length > 0 && (
        <div style={{ background: `${C.red}10`, border: `1.5px solid ${C.red}30`, borderRadius: 12, padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 10 }}>
          <AlertTriangle size={18} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.red }}>{anomalies.length} кампания с аномальной наградой</div>
            <div style={{ fontSize: 12, color: C.t3 }}>Награда {'>'} 5 000 GEO — требует проверки</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all','Все'],['active','Активные'],['inactive','Остановленные'],['anomaly','Аномалии']].map(([k, lbl]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: filter === k ? C.accentD : C.card,
            border: `1px solid ${filter === k ? C.accentGl : C.border}`,
            color: filter === k ? C.accent : C.t3, cursor: 'pointer',
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Loader2 size={22} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: C.t3 }}>Нет кампаний</div>
        )}
        {!loading && filtered.map(c => {
          const fillPct = c.max_visits > 0 ? Math.round(c.visits_count / c.max_visits * 100) : 0;
          return (
            <div key={c.id} style={{
              background: C.card,
              border: `1px solid ${c.isAnomaly ? `${C.red}50` : c.active ? `${C.green}30` : C.border}`,
              borderRadius: 14, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: C.t1 }}>{c.business_name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.active ? C.green : C.t3, background: c.active ? C.greenD : 'rgba(255,255,255,0.04)', borderRadius: 5, padding: '1px 7px', border: `1px solid ${c.active ? C.green + '25' : C.border}` }}>
                      {c.active ? 'Активна' : 'Стоп'}
                    </span>
                    {c.isAnomaly && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: C.redD, borderRadius: 5, padding: '1px 7px' }}>⚠ АНОМАЛИЯ</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.t3 }}>
                    {c.task_type} · {c.visits_count}/{c.max_visits} визитов ({fillPct}%)
                    {c.ends_at && ` · до ${fmtDate(c.ends_at)}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, color: C.accent }}>+{fmt(c.reward_amount)}</div>
                  <div style={{ fontSize: 10, color: C.t3 }}>GEO/визит</div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 4, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: 4, borderRadius: 4, width: `${fillPct}%`, background: c.active ? C.green : C.t3, transition: 'width 0.5s' }} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditCampaign(c)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, color: C.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Pencil size={12} /> Изменить
                </button>
                <button onClick={() => toggle(c.id)} disabled={busy === c.id}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: c.active ? C.redD : C.greenD, border: `1px solid ${c.active ? C.red + '30' : C.green + '30'}`, borderRadius: 8, color: c.active ? C.red : C.green, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {busy === c.id
                    ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : c.active ? <><PauseCircle size={13} /> Стоп</> : <><PlayCircle size={13} /> Запустить</>
                  }
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editCampaign && (
        <EditModal
          campaign={editCampaign}
          onClose={() => setEditCampaign(null)}
          onSaved={() => { setEditCampaign(null); load(); }}
        />
      )}
      {showCreate && (
        <PlatformCampaignModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
