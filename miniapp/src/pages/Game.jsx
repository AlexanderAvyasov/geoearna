import { useEffect, useState } from 'react';
import {
  Flame, Trophy, Crown, Gift, Users, Zap, TrendingUp,
  Copy, Check, CheckCircle2, Lock, Loader2, Star, Target,
} from 'lucide-react';
import { initData } from '../hooks/useTelegram';
import { API_BASE } from '../lib/api';
import { C, G, E, cardBase } from '../lib/design';

// ── Level config ─────────────────────────────────────────────────────────────
const LV = {
  1: { label: 'Новичок',       color: '#6B7280', bg: 'rgba(107,114,128,0.15)', min: 0,     next: 500   },
  2: { label: 'Исследователь', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)',  min: 500,   next: 2000  },
  3: { label: 'Постоянный',    color: '#10B981', bg: 'rgba(16,185,129,0.15)',  min: 2000,  next: 6000  },
  4: { label: 'Эксперт',       color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', min: 6000,  next: 15000 },
  5: { label: 'Легенда',       color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', min: 15000, next: null  },
};

function xpPct(xp, level) {
  const cfg = LV[level] || LV[1];
  if (!cfg.next) return 1;
  return Math.min(1, (xp - cfg.min) / (cfg.next - cfg.min));
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  const s = (h, w = '100%') => ({
    height: h, width: w, borderRadius: 8,
    background: 'rgba(255,255,255,0.06)',
    animation: 'pulse 1.5s ease-in-out infinite',
  });
  return (
    <div style={{ padding: '0 16px', animation: 'fadeUp 0.3s ease both' }}>
      <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: 20, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={s(28, 120)} /><div style={s(28, 90)} />
        </div>
        <div style={s(6)} /><div style={{ ...s(10, 60), marginTop: 6 }} />
      </div>
      {[1,2,3].map(i => <div key={i} style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: 16, marginBottom: 8 }}>
        <div style={s(14, '70%')} /><div style={{ ...s(10, '40%'), marginTop: 8 }} />
      </div>)}
    </div>
  );
}

// ── Profile card ──────────────────────────────────────────────────────────────
function ProfileCard({ data }) {
  const lv      = data.level || 1;
  const cfg     = LV[lv] || LV[1];
  const xp      = data.xp || 0;
  const pct     = xpPct(xp, lv);
  const streak  = data.streak?.current_streak || 0;
  const freeze  = data.streak?.freeze_available || 0;
  const projected = data.projectedStreak || streak;
  const isMilestone = [7, 14, 30].includes(projected);

  return (
    <div style={{
      ...cardBase,
      border: `1px solid ${cfg.color}28`,
      padding: '18px 16px 16px',
      marginBottom: 12,
      background: `linear-gradient(135deg, #0D1520 0%, ${cfg.bg.replace('0.15', '0.08')} 100%)`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* ambient glow */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 150, height: 150, borderRadius: '50%',
        background: `radial-gradient(circle, ${cfg.color}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Level + Streak */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: cfg.bg, borderRadius: 12, padding: '7px 12px',
          border: `1px solid ${cfg.color}40`,
        }}>
          <Crown size={14} color={cfg.color} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color }}>
            L{lv} · {cfg.label}
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: streak > 0 ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
          borderRadius: 12, padding: '7px 12px',
          border: `1px solid ${streak > 0 ? 'rgba(249,115,22,0.35)' : C.b1}`,
        }}>
          <Flame size={14} color={streak > 0 ? '#F97316' : C.t3} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 800, color: streak > 0 ? '#F97316' : C.t3 }}>
            {streak} {streak % 10 === 1 && streak !== 11 ? 'день' : streak % 10 >= 2 && streak % 10 <= 4 && (streak < 10 || streak > 20) ? 'дня' : 'дней'}
          </span>
        </div>
      </div>

      {/* XP bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Опыт (XP)
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>
            {xp.toLocaleString('ru-RU')}
            {cfg.next ? ` / ${cfg.next.toLocaleString('ru-RU')}` : ' · МАКС'}
          </span>
        </div>
        <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.round(pct * 100)}%`,
            background: `linear-gradient(90deg, ${cfg.color}bb, ${cfg.color})`,
            borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: `0 0 10px ${cfg.color}60`,
          }} />
        </div>
        {cfg.next && (
          <div style={{ fontSize: 11, color: C.t3, marginTop: 5, display: 'flex', justifyContent: 'space-between' }}>
            <span>{freeze > 0 ? `❄️ Заморозок: ${freeze}` : ''}</span>
            <span>+{(cfg.next - xp).toLocaleString('ru-RU')} XP до L{lv + 1}</span>
          </div>
        )}
      </div>

      {/* Milestone banner */}
      {isMilestone && streak > 0 && (
        <div style={{
          marginTop: 12,
          background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
          borderRadius: 12, padding: '8px 12px',
          fontSize: 13, color: '#F97316', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Star size={14} color="#F97316" strokeWidth={2} />
          Сегодня юбилейный день! Бонус ×1.5 к следующему чекину
        </div>
      )}
    </div>
  );
}

// ── Tasks tab ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onClaim, claiming }) {
  const req   = task.requirement || {};
  const total = req.distinct_businesses || req.distinct_categories || req.streak_days || req.checkin_count || req.referral_activated || req.withdrawal_count || 1;
  const prog  = Math.min(task.progress || 0, total);
  const pct   = total > 1 ? prog / total : 0;
  const canClaim = task.completed && !task.claimed;
  const done     = task.claimed;

  return (
    <div style={{
      ...cardBase,
      border: `1px solid ${done ? 'rgba(16,185,129,0.12)' : canClaim ? 'rgba(124,58,237,0.3)' : C.b1}`,
      padding: '14px 16px', marginBottom: 8,
      opacity: done ? 0.55 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: done ? C.t2 : C.t1, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
            {done && <CheckCircle2 size={14} color={C.emerald} strokeWidth={2.5} />}
            {task.title}
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 12, color: C.t3, marginBottom: (canClaim || total > 1) && !done ? 8 : 0 }}>
            <span style={{ color: C.gold, fontWeight: 700 }}>+{task.geo_reward} GEO</span>
            <span>·</span>
            <span style={{ color: C.purpleL, fontWeight: 700 }}>+{task.xp_reward} XP</span>
          </div>

          {!done && total > 1 && (
            <div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{
                  height: '100%', width: `${Math.round(pct * 100)}%`,
                  background: canClaim
                    ? 'linear-gradient(90deg,#059669,#10B981)'
                    : 'linear-gradient(90deg,#7C3AED,#6366F1)',
                  borderRadius: 99, transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ fontSize: 11, color: C.t3 }}>{prog} / {total}</div>
            </div>
          )}
        </div>

        {canClaim && (
          <button
            onClick={() => onClaim(task.key)}
            disabled={!!claiming}
            style={{
              background: G.accent, color: '#fff', border: 'none',
              borderRadius: 12, padding: '8px 14px',
              fontSize: 12, fontWeight: 700, cursor: claiming ? 'not-allowed' : 'pointer',
              flexShrink: 0, opacity: claiming ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
            }}
          >
            {claiming && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            Забрать
          </button>
        )}
      </div>
    </div>
  );
}

function TasksTab({ tasks, onClaim, claiming }) {
  const groups = [
    { title: 'Ежедневные',   type: 'daily'   },
    { title: 'Еженедельные', type: 'weekly'  },
    { title: 'Разовые',      type: 'onetime' },
  ];

  return (
    <div>
      {groups.map(({ title, type }) => {
        const items = (tasks || []).filter(t => t.type === type);
        if (!items.length) return null;
        return (
          <div key={type} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              {title}
            </div>
            {items.map(t => <TaskCard key={t.key} task={t} onClaim={onClaim} claiming={claiming === t.key} />)}
          </div>
        );
      })}
    </div>
  );
}

// ── Achievements tab ──────────────────────────────────────────────────────────
function AchievementCard({ ach }) {
  const { earned } = ach;
  return (
    <div style={{
      ...cardBase,
      border: `1px solid ${earned ? 'rgba(245,158,11,0.25)' : C.b0}`,
      padding: '16px 14px',
      opacity: earned ? 1 : 0.5,
      position: 'relative', overflow: 'hidden',
      background: earned ? 'linear-gradient(135deg,#0D1520 0%,rgba(245,158,11,0.06) 100%)' : undefined,
    }}>
      <div style={{ position: 'absolute', top: 8, right: 8 }}>
        {earned
          ? <CheckCircle2 size={14} color={C.gold} strokeWidth={2.5} />
          : <Lock size={13} color={C.t3} strokeWidth={1.75} />
        }
      </div>
      <Trophy size={26} color={earned ? C.gold : C.t3} strokeWidth={1.75} style={{ marginBottom: 10 }} />
      <div style={{ fontWeight: 800, fontSize: 13, color: earned ? C.t1 : C.t2, marginBottom: 4, lineHeight: 1.3, paddingRight: 20 }}>
        {ach.title}
      </div>
      <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.4, marginBottom: 8 }}>
        {ach.description}
      </div>
      {ach.geo_reward > 0 && (
        <div style={{ fontSize: 12, color: C.gold, fontWeight: 700 }}>+{ach.geo_reward} GEO</div>
      )}
      {ach.xp_reward > 0 && (
        <div style={{ fontSize: 11, color: C.purpleL, fontWeight: 700, marginTop: 2 }}>+{ach.xp_reward} XP</div>
      )}
    </div>
  );
}

function AchievementsTab({ achievements }) {
  const earned = (achievements || []).filter(a => a.earned);
  const locked = (achievements || []).filter(a => !a.earned);
  return (
    <div>
      {earned.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            Получены ({earned.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {earned.map(a => <AchievementCard key={a.key} ach={a} />)}
          </div>
        </div>
      )}
      {locked.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            Заблокированы ({locked.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {locked.map(a => <AchievementCard key={a.key} ach={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Referral tab ──────────────────────────────────────────────────────────────
function ReferralTab({ referral }) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const link = referral?.link;
    if (!link) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      });
    }
  }

  return (
    <div>
      {/* Link card */}
      <div style={{ ...cardBase, border: `1px solid rgba(124,58,237,0.2)`, padding: '18px 16px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
          Ваша реферальная ссылка
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.04)', borderRadius: 12,
          padding: '10px 14px', marginBottom: 12,
          fontSize: 13, color: C.t2, wordBreak: 'break-all',
          border: `1px solid ${C.b1}`,
        }}>
          {referral?.link || '—'}
        </div>
        <button onClick={copyLink} style={{
          width: '100%',
          background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(124,58,237,0.12)',
          border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(124,58,237,0.3)'}`,
          borderRadius: 13, padding: '12px 16px',
          color: copied ? C.emerald : C.purpleL,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s',
        }}>
          {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2} />}
          {copied ? 'Скопировано!' : 'Копировать ссылку'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Приглашено', value: referral?.totalReferrals || 0,    color: C.purpleL },
          { label: 'Активных',   value: referral?.activatedReferrals || 0, color: C.emerald },
          { label: 'Заработано', value: `${referral?.totalEarned || 0}`,   color: C.gold, sub: 'GEO' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '13px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>
              {value}
              {sub && <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 2 }}>{sub}</span>}
            </div>
            <div style={{ fontSize: 10, color: C.t3, marginTop: 4, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div style={{ ...cardBase, border: `1px solid ${C.b0}`, padding: '16px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
          Как это работает
        </div>
        {[
          [Gift,       'Поделитесь ссылкой с другом'],
          [Users,      'Друг делает первый чекин в течение 7 дней'],
          [Zap,        'Вы +1 000 GEO, друг +500 GEO приветственный бонус'],
          [TrendingUp, '+5% от каждого чекина друга в течение 30 дней'],
        ].map(([Icon, text]) => (
          <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 11, flexShrink: 0,
              background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={16} color={C.purpleL} strokeWidth={1.75} />
            </div>
            <span style={{ fontSize: 13, color: C.t2, lineHeight: 1.5, paddingTop: 8 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'tasks',        label: 'Задания',     Icon: Target  },
  { key: 'achievements', label: 'Достижения',  Icon: Trophy  },
  { key: 'referral',     label: 'Рефералы',    Icon: Gift    },
];

export default function Game() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('tasks');
  const [claiming, setClaiming] = useState(null); // task key being claimed
  const [toast,   setToast]   = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/me/game`, { headers: { initdata: initData } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 2500);
  }

  async function handleClaim(taskKey) {
    if (claiming) return;
    setClaiming(taskKey);
    try {
      const r = await fetch(`${API_BASE}/api/me/tasks/${taskKey}/claim`, {
        method: 'POST',
        headers: { initdata: initData },
      });
      const body = await r.json();
      if (!r.ok) {
        showToast(body.error === 'ALREADY_CLAIMED' ? 'Уже получено' : 'Не удалось получить', true);
        return;
      }
      showToast(`+${body.geoRewarded} GEO${body.leveledUp ? ' · Новый уровень!' : ''}`);
      // Update local task state
      setData(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.key === taskKey ? { ...t, claimed: true } : t),
        // reflect new balance/xp (optimistic)
        xp: body.newXp,
        level: body.newLevel,
      }));
    } catch {
      showToast('Ошибка соединения', true);
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, animation: 'pageEnter 0.35s ease both' }}>
      {/* Header */}
      <div style={{
        background: 'rgba(7,11,20,0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '14px 16px 0',
        borderBottom: `1px solid ${C.b1}`,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: C.t1, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={20} color={C.gold} strokeWidth={2} />
          Прогресс
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)} style={{
                flex: 1, background: 'none', border: 'none',
                paddingBottom: 12, paddingTop: 4,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: 'pointer',
                borderBottom: `2px solid ${active ? C.purpleL : 'transparent'}`,
                transition: 'border-color 0.2s',
              }}>
                <Icon size={16} color={active ? C.purpleL : C.t3} strokeWidth={active ? 2.25 : 1.75} />
                <span style={{ fontSize: 11, fontWeight: 700, color: active ? C.purpleL : C.t3, letterSpacing: 0.3 }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '14px 16px 32px' }}>
        {loading
          ? <Skeleton />
          : !data
            ? (
              <div style={{ textAlign: 'center', paddingTop: 60, color: C.t3, fontSize: 15 }}>
                Не удалось загрузить данные
              </div>
            )
            : (
              <>
                <ProfileCard data={data} />

                {tab === 'tasks' && (
                  <TasksTab tasks={data.tasks} onClaim={handleClaim} claiming={claiming} />
                )}
                {tab === 'achievements' && (
                  <AchievementsTab achievements={data.achievements} />
                )}
                {tab === 'referral' && (
                  <ReferralTab referral={data.referral} />
                )}
              </>
            )
        }
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%',
          transform: 'translate(-50%, 0)',
          background: toast.isError ? 'rgba(239,68,68,0.95)' : 'rgba(13,17,23,0.97)',
          backdropFilter: 'blur(20px)',
          color: '#fff', borderRadius: 14,
          padding: '12px 22px', fontSize: 14, fontWeight: 700,
          zIndex: 500, whiteSpace: 'nowrap',
          animation: 'toastIn 0.25s ease',
          border: `1px solid ${toast.isError ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
