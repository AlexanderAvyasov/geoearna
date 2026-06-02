import React, { useEffect, useState } from 'react';
import { Megaphone, Gift, Settings, FileText, Send, RefreshCw, Loader2, X, Check } from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmtDate } from '../lib/design.js';

const SETTING_META = [
  { key: 'referral_bonus_referrer', label: 'Бонус рефереру',     hint: 'GEO рефереру при первом чекине друга' },
  { key: 'referral_bonus_new_user', label: 'Бонус новому юзеру', hint: 'GEO новому за приход по реф. ссылке' },
  { key: 'milestone_geo_7',         label: 'Стрик 7 дней',       hint: 'GEO за 7-дневный streak milestone' },
  { key: 'milestone_geo_14',        label: 'Стрик 14 дней',      hint: 'GEO за 14-дневный streak milestone' },
  { key: 'milestone_geo_30',        label: 'Стрик 30 дней',      hint: 'GEO за 30-дневный streak milestone' },
  { key: 'new_place_bonus',         label: 'Бонус нового места',  hint: 'GEO за чекин в заведении < 7 дней' },
];

const ACTION_COLORS = {
  user_ban:           C.red,
  user_unban:         C.green,
  geo_credit:         C.green,
  geo_debit:          C.orange,
  business_suspend:   C.red,
  business_unsuspend: C.green,
  rate_change:        C.accent,
};

function SectionHeader({ icon: Icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
      <Icon size={14} color={C.t3} />
      <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8 }}>{children}</span>
    </div>
  );
}

function BonusSettings() {
  const [settings, setSettings] = useState(null);
  const [drafts,   setDrafts]   = useState({});
  const [saving,   setSaving]   = useState({});
  const [saved,    setSaved]    = useState({});
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.get('/api/superadmin/platform-settings')
      .then(r => r.ok ? r.json() : { settings: {} })
      .then(d => {
        setSettings(d.settings || {});
        setDrafts(Object.fromEntries(Object.entries(d.settings || {}).map(([k, v]) => [k, String(v)])));
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(key) {
    const val = Number(drafts[key]);
    if (!Number.isFinite(val) || val < 0) return;
    setSaving(s => ({ ...s, [key]: true }));
    const r = await api.put(`/api/superadmin/platform-settings/${key}`, { value: val });
    if (r.ok) {
      setSettings(s => ({ ...s, [key]: val }));
      setSaved(s => ({ ...s, [key]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2000);
    }
    setSaving(s => ({ ...s, [key]: false }));
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 20px', marginBottom: 16 }}>
      <SectionHeader icon={Gift}>Бонусы и рефералы</SectionHeader>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Loader2 size={18} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      ) : SETTING_META.map(({ key, label, hint }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{label}</div>
            <div style={{ fontSize: 11, color: C.t3 }}>{hint}</div>
          </div>
          <input
            type="number" min="0" step="1"
            value={drafts[key] ?? ''}
            onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
            style={{ width: 80, padding: '6px 8px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.t1, fontSize: 13, textAlign: 'right', outline: 'none' }}
          />
          <button
            onClick={() => save(key)}
            disabled={saving[key] || Number(drafts[key]) === settings?.[key]}
            style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: saved[key] ? C.greenD : C.accentD,
              color: saved[key] ? C.green : C.accent,
              border: `1px solid ${saved[key] ? C.green + '30' : C.accentGl}`,
              fontSize: 11, fontWeight: 700,
              opacity: (saving[key] || Number(drafts[key]) === settings?.[key]) ? 0.4 : 1,
              transition: 'all 0.2s', minWidth: 52,
            }}
          >
            {saved[key] ? <Check size={12} /> : saving[key] ? '...' : 'Сохр.'}
          </button>
        </div>
      ))}
    </div>
  );
}

function Broadcast() {
  const [counts,   setCounts]   = useState(null);
  const [target,   setTarget]   = useState('all');
  const [message,  setMessage]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [confirm,  setConfirm]  = useState(false);

  useEffect(() => {
    api.get('/api/superadmin/broadcast/counts')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setCounts(d));
  }, []);

  const recipientCount = counts
    ? (target === 'all' ? counts.all : target === 'active_7d' ? counts.active_7d : counts.active_30d)
    : null;

  async function send() {
    setSending(true); setResult(null); setConfirm(false);
    const r = await api.post('/api/superadmin/broadcast', { message, target });
    if (r.ok) {
      const d = await r.json();
      setResult(d);
      setMessage('');
    } else {
      setResult({ error: 'Ошибка отправки' });
    }
    setSending(false);
  }

  const TARGET_LABELS = { all: 'Все', active_7d: 'Активные 7д', active_30d: 'Активные 30д' };

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px', marginBottom: 16 }}>
      <SectionHeader icon={Megaphone}>Рассылка</SectionHeader>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['all', 'active_7d', 'active_30d'].map(t => {
          const cnt = counts ? (t === 'all' ? counts.all : t === 'active_7d' ? counts.active_7d : counts.active_30d) : null;
          return (
            <button key={t} onClick={() => { setTarget(t); setResult(null); }} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: target === t ? C.accentD : 'rgba(255,255,255,0.04)',
              border: `1px solid ${target === t ? C.accentGl : C.border}`,
              color: target === t ? C.accent : C.t3,
              transition: 'all 0.15s',
            }}>
              {TARGET_LABELS[t]}
              {cnt !== null && <span style={{ opacity: 0.65, fontWeight: 400, marginLeft: 4 }}>({cnt})</span>}
            </button>
          );
        })}
      </div>

      <textarea
        value={message}
        onChange={e => { setMessage(e.target.value); setResult(null); setConfirm(false); }}
        placeholder="Текст рассылки (поддерживает Markdown)..."
        rows={4}
        style={{ width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px', color: C.t1, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit', marginBottom: 4 }}
      />
      <div style={{ textAlign: 'right', fontSize: 11, color: message.length > 3800 ? C.red : C.t3, marginBottom: 12 }}>
        {message.length} / 4096
      </div>

      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          disabled={message.trim().length < 5 || sending}
          style={{ width: '100%', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 10, color: C.accent, fontSize: 13, fontWeight: 700, cursor: message.trim().length < 5 ? 'not-allowed' : 'pointer', opacity: message.trim().length < 5 ? 0.5 : 1 }}
        >
          <Send size={14} />
          Отправить{recipientCount !== null ? ` (${recipientCount})` : ''}
        </button>
      ) : (
        <div style={{ background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: C.t1, marginBottom: 12 }}>
            Отправить <strong style={{ color: C.accent }}>{recipientCount}</strong> пользователям?
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => setConfirm(false)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
            <button onClick={send} disabled={sending} style={{ padding: '8px 20px', background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 8, color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {sending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
              Подтвердить
            </button>
          </div>
        </div>
      )}

      {result && !result.error && (
        <div style={{ marginTop: 12, background: C.greenD, border: `1px solid ${C.green}30`, borderRadius: 10, padding: '12px' }}>
          <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginBottom: 2 }}>Рассылка завершена</div>
          <div style={{ fontSize: 12, color: C.t2 }}>
            Отправлено: {result.sent} / {result.total} · Ошибок: {result.failed}
          </div>
        </div>
      )}
      {result?.error && (
        <div style={{ marginTop: 12, background: C.redD, border: `1px solid ${C.red}30`, borderRadius: 10, padding: '12px' }}>
          <div style={{ fontSize: 12, color: C.red }}>{result.error}</div>
        </div>
      )}
    </div>
  );
}

export default function System() {
  const [cfg,      setCfg]      = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [auditWarn, setAuditWarn] = useState('');
  const [loading,  setLoading]  = useState(true);

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/api/superadmin/platform-config').then(r => r.ok ? r.json() : null),
      api.get('/api/superadmin/audit-log').then(r => r.ok ? r.json() : { log: [] }),
    ]).then(([c, a]) => {
      setCfg(c);
      setAuditLog(a.log || []);
      if (a.warning) setAuditWarn(a.warning);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Система</h1>
          <div style={{ fontSize: 13, color: C.t3 }}>Рассылки, бонусы, конфиг</div>
        </div>
        <button onClick={load} style={{ padding: '8px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <Broadcast />
      <BonusSettings />

      {/* Platform config */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px', marginBottom: 16 }}>
        <SectionHeader icon={Settings}>Конфигурация платформы</SectionHeader>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Loader2 size={18} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        ) : cfg ? (
          [
            ['GEO Rate (env)', `${cfg.geoRate} UZS / GEO`],
            ['Topup Card',     cfg.topupCard || '—'],
            ['Topup Bank',     cfg.topupBank || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.t3 }}>{k}</span>
              <code style={{ fontSize: 13, color: C.t1, background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>{v}</code>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 13, color: C.t3 }}>Нет данных</div>
        )}
      </div>

      {/* Audit log */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px' }}>
        <SectionHeader icon={FileText}>
          Audit Log {auditWarn ? '(недоступен)' : `(${auditLog.length})`}
        </SectionHeader>

        {auditWarn && (
          <div style={{ fontSize: 12, color: C.orange, background: `${C.orange}10`, borderRadius: 10, padding: '10px 12px', marginBottom: 12, border: `1px solid ${C.orange}20` }}>
            ⚠ {auditWarn}. Создайте таблицу <code>sa_audit_log</code> в Supabase.
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Loader2 size={18} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        )}

        {!loading && auditLog.length === 0 && !auditWarn && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.t3, fontSize: 13 }}>
            <FileText size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
            Лог пуст
          </div>
        )}

        {!loading && auditLog.map((entry, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: ACTION_COLORS[entry.action] || C.t1, marginBottom: 2 }}>
                {entry.action}
              </div>
              {entry.note      && <div style={{ fontSize: 11, color: C.t3 }}>{entry.note}</div>}
              {entry.target_id && <div style={{ fontSize: 11, color: C.t3 }}>ID: {entry.target_id}</div>}
            </div>
            <div style={{ fontSize: 11, color: C.t3, flexShrink: 0, marginLeft: 12 }}>{fmtDate(entry.created_at)}</div>
          </div>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
