import React, { useEffect, useState } from 'react';
import { Target, Trophy, Plus, Trash2, Loader2, Check, X, RefreshCw } from 'lucide-react';
import { api } from '../lib/api.js';
import { C, fmt } from '../lib/design.js';

const TYPE_LABEL = { daily: 'Ежедневные', weekly: 'Еженедельные', onetime: 'Разовые' };
const TYPE_COLOR = { daily: C.blue, weekly: C.green, onetime: C.gold };

function InlineEdit({ value, onSave, type = 'text' }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  if (!editing) return (
    <span
      onClick={() => { setVal(value); setEditing(true); }}
      style={{ cursor: 'pointer', borderBottom: `1px dashed ${C.border2}` }}
    >
      {value}
    </span>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        autoFocus value={val} onChange={e => setVal(e.target.value)} type={type}
        style={{ background: C.card, border: `1.5px solid ${C.accentGl}`, borderRadius: 6, padding: '3px 7px', color: C.t1, fontSize: 'inherit', width: type === 'number' ? 70 : 160, outline: 'none' }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(val); setEditing(false); }
          if (e.key === 'Escape') setEditing(false);
        }}
      />
      <button onClick={() => { onSave(val); setEditing(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, padding: 2 }}><Check size={13} /></button>
      <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 2 }}><X size={13} /></button>
    </span>
  );
}

const inStyle = (extra = {}) => ({
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10,
  border: `1px solid ${C.border}`, background: C.bg, color: C.t1,
  fontSize: 13, outline: 'none', marginBottom: 8, ...extra,
});

export default function Gamification() {
  const [section,     setSection]     = useState('tasks');
  const [tasks,       setTasks]       = useState([]);
  const [achs,        setAchs]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [busy,        setBusy]        = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddAch,  setShowAddAch]  = useState(false);
  const [newTask,     setNewTask]     = useState({ key: '', type: 'daily', title: '', geo_reward: '', xp_reward: '' });
  const [newAch,      setNewAch]      = useState({ key: '', title: '', description: '', geo_reward: '', xp_reward: '' });
  const [msg,         setMsg]         = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/api/superadmin/tasks').then(r => r.ok ? r.json() : { tasks: [] }),
      api.get('/api/superadmin/achievements').then(r => r.ok ? r.json() : { achievements: [] }),
    ]).then(([t, a]) => {
      setTasks(t.tasks || []);
      setAchs(a.achievements || []);
    }).catch(e => setMsg(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function patchTask(key, updates) {
    setBusy(key);
    const r = await api.patch(`/api/superadmin/tasks/${key}`, updates);
    if (r.ok) setTasks(prev => prev.map(t => t.key === key ? { ...t, ...updates } : t));
    else setMsg('Ошибка сохранения');
    setBusy(null);
  }

  async function deleteTask(key) {
    if (!confirm(`Удалить задание "${key}"?`)) return;
    setBusy(key);
    const r = await api.delete(`/api/superadmin/tasks/${key}`);
    if (r.ok) setTasks(prev => prev.filter(t => t.key !== key));
    else setMsg('Ошибка удаления');
    setBusy(null);
  }

  async function createTask() {
    if (!newTask.key || !newTask.title) return setMsg('Заполните key и title');
    setBusy('create_task');
    const r = await api.post('/api/superadmin/tasks', {
      ...newTask, geo_reward: Number(newTask.geo_reward), xp_reward: Number(newTask.xp_reward), requirement: {},
    });
    if (r.ok) {
      const d = await r.json();
      setTasks(prev => [...prev, d.task]);
      setNewTask({ key: '', type: 'daily', title: '', geo_reward: '', xp_reward: '' });
      setShowAddTask(false);
    } else setMsg('Ошибка создания');
    setBusy(null);
  }

  async function patchAch(key, updates) {
    setBusy(key);
    const r = await api.patch(`/api/superadmin/achievements/${key}`, updates);
    if (r.ok) setAchs(prev => prev.map(a => a.key === key ? { ...a, ...updates } : a));
    else setMsg('Ошибка сохранения');
    setBusy(null);
  }

  async function deleteAch(key) {
    if (!confirm(`Удалить достижение "${key}"?`)) return;
    setBusy(key);
    const r = await api.delete(`/api/superadmin/achievements/${key}`);
    if (r.ok) setAchs(prev => prev.filter(a => a.key !== key));
    else setMsg('Ошибка удаления');
    setBusy(null);
  }

  async function createAch() {
    if (!newAch.key || !newAch.title || !newAch.description) return setMsg('Заполните key, title, description');
    setBusy('create_ach');
    const r = await api.post('/api/superadmin/achievements', {
      ...newAch, geo_reward: Number(newAch.geo_reward), xp_reward: Number(newAch.xp_reward), requirement: {},
    });
    if (r.ok) {
      const d = await r.json();
      setAchs(prev => [...prev, d.achievement]);
      setNewAch({ key: '', title: '', description: '', geo_reward: '', xp_reward: '' });
      setShowAddAch(false);
    } else setMsg('Ошибка создания');
    setBusy(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1 }}>Геймификация</h1>
          <div style={{ fontSize: 13, color: C.t3 }}>{tasks.length} заданий · {achs.length} достижений</div>
        </div>
        <button onClick={load} style={{ padding: '8px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3 }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {msg && (
        <div style={{ background: C.redD, border: `1px solid ${C.red}30`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.red, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
          {msg}
          <button onClick={() => setMsg('')} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {/* Section switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['tasks', 'Задания', Target], ['achievements', 'Достижения', Trophy]].map(([k, lbl, Icon]) => (
          <button key={k} onClick={() => setSection(k)} style={{
            flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            border: `1px solid ${section === k ? C.accent + '60' : C.border}`,
            background: section === k ? C.accentD : C.card,
            color: section === k ? C.accent : C.t3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <Icon size={14} />
            {lbl}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Loader2 size={22} color={C.t3} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      )}

      {/* ── Tasks ── */}
      {!loading && section === 'tasks' && (
        <div>
          {['daily', 'weekly', 'onetime'].map(type => {
            const items = tasks.filter(t => t.type === type);
            if (!items.length) return null;
            return (
              <div key={type} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[type], textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                  {TYPE_LABEL[type]}
                </div>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  {items.map((t, i) => (
                    <div key={t.key} style={{ padding: '12px 16px', borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 3 }}>
                            <InlineEdit value={t.title} onSave={v => patchTask(t.key, { title: v })} />
                          </div>
                          <code style={{ fontSize: 11, color: C.t3, background: `${C.border}80`, padding: '1px 6px', borderRadius: 5 }}>{t.key}</code>
                        </div>
                        <button
                          onClick={() => deleteTask(t.key)}
                          disabled={busy === t.key}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: '2px 4px', flexShrink: 0, opacity: 0.6 }}
                        >
                          {busy === t.key ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
                        <span style={{ color: C.t3 }}>GEO:</span>
                        <span style={{ color: C.gold, fontWeight: 700 }}>
                          <InlineEdit value={t.geo_reward} onSave={v => patchTask(t.key, { geo_reward: Number(v) })} type="number" />
                        </span>
                        <span style={{ color: C.t3, marginLeft: 4 }}>XP:</span>
                        <span style={{ color: C.purple, fontWeight: 700 }}>
                          <InlineEdit value={t.xp_reward} onSave={v => patchTask(t.key, { xp_reward: Number(v) })} type="number" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: C.t3 }}>Нет заданий</div>}

          {showAddTask ? (
            <div style={{ background: C.card, border: `1.5px solid ${C.accentGl}`, borderRadius: 14, padding: '16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 12 }}>Новое задание</div>
              <input value={newTask.key} onChange={e => setNewTask(p => ({ ...p, key: e.target.value }))} placeholder="key (snake_case)" style={inStyle()} />
              <select value={newTask.type} onChange={e => setNewTask(p => ({ ...p, type: e.target.value }))} style={{ ...inStyle(), appearance: 'none', WebkitAppearance: 'none' }}>
                <option value="daily">Ежедневное</option>
                <option value="weekly">Еженедельное</option>
                <option value="onetime">Разовое</option>
              </select>
              <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Название задания" style={inStyle()} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newTask.geo_reward} onChange={e => setNewTask(p => ({ ...p, geo_reward: e.target.value }))} placeholder="GEO" type="number" style={inStyle({ flex: 1 })} />
                <input value={newTask.xp_reward} onChange={e => setNewTask(p => ({ ...p, xp_reward: e.target.value }))} placeholder="XP" type="number" style={inStyle({ flex: 1 })} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowAddTask(false)} style={{ flex: 1, padding: '9px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
                <button onClick={createTask} disabled={busy === 'create_task'} style={{ flex: 2, padding: '9px', background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 8, color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {busy === 'create_task' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                  Создать
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddTask(true)} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: `1px dashed ${C.border}`, borderRadius: 10, color: C.t3, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 }}>
              <Plus size={14} /> Добавить задание
            </button>
          )}
        </div>
      )}

      {/* ── Achievements ── */}
      {!loading && section === 'achievements' && (
        <div>
          {achs.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: C.t3 }}>Нет достижений</div>}

          {achs.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
              {achs.map((a, i) => (
                <div key={a.key} style={{ padding: '14px 16px', borderBottom: i < achs.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.gold, marginBottom: 3 }}>
                        <InlineEdit value={a.title} onSave={v => patchAch(a.key, { title: v })} />
                      </div>
                      <div style={{ fontSize: 12, color: C.t3, marginBottom: 4 }}>
                        <InlineEdit value={a.description} onSave={v => patchAch(a.key, { description: v })} />
                      </div>
                      <code style={{ fontSize: 11, color: C.t3, background: `${C.border}80`, padding: '1px 6px', borderRadius: 5 }}>{a.key}</code>
                    </div>
                    <button
                      onClick={() => deleteAch(a.key)}
                      disabled={busy === a.key}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: '2px 4px', flexShrink: 0, opacity: 0.6 }}
                    >
                      {busy === a.key ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
                    <span style={{ color: C.t3 }}>GEO:</span>
                    <span style={{ color: C.gold, fontWeight: 700 }}>
                      <InlineEdit value={a.geo_reward} onSave={v => patchAch(a.key, { geo_reward: Number(v) })} type="number" />
                    </span>
                    <span style={{ color: C.t3, marginLeft: 4 }}>XP:</span>
                    <span style={{ color: C.purple, fontWeight: 700 }}>
                      <InlineEdit value={a.xp_reward} onSave={v => patchAch(a.key, { xp_reward: Number(v) })} type="number" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddAch ? (
            <div style={{ background: C.card, border: `1.5px solid ${C.accentGl}`, borderRadius: 14, padding: '16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 12 }}>Новое достижение</div>
              <input value={newAch.key} onChange={e => setNewAch(p => ({ ...p, key: e.target.value }))} placeholder="key (snake_case)" style={inStyle()} />
              <input value={newAch.title} onChange={e => setNewAch(p => ({ ...p, title: e.target.value }))} placeholder="Название" style={inStyle()} />
              <input value={newAch.description} onChange={e => setNewAch(p => ({ ...p, description: e.target.value }))} placeholder="Описание" style={inStyle()} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newAch.geo_reward} onChange={e => setNewAch(p => ({ ...p, geo_reward: e.target.value }))} placeholder="GEO" type="number" style={inStyle({ flex: 1 })} />
                <input value={newAch.xp_reward} onChange={e => setNewAch(p => ({ ...p, xp_reward: e.target.value }))} placeholder="XP" type="number" style={inStyle({ flex: 1 })} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowAddAch(false)} style={{ flex: 1, padding: '9px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 8, color: C.t3, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
                <button onClick={createAch} disabled={busy === 'create_ach'} style={{ flex: 2, padding: '9px', background: C.accentD, border: `1px solid ${C.accentGl}`, borderRadius: 8, color: C.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {busy === 'create_ach' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                  Создать
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddAch(true)} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: `1px dashed ${C.border}`, borderRadius: 10, color: C.t3, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
              <Plus size={14} /> Добавить достижение
            </button>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
