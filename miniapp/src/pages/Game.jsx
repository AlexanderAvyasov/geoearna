import { useEffect, useState } from 'react';
import {
  Flame, Trophy, Crown, Gift, Users, Zap, TrendingUp,
  Copy, Check, CheckCircle2, Lock, Loader2, Star, Target,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { C, cardBase } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';

const SYNE = { fontFamily: "'Syne', sans-serif" };

const LV = {
  1:  { color: '#6B7280', bg: 'rgba(107,114,128,0.10)', min: 0,    next: 100   },
  2:  { color: '#3B82F6', bg: 'rgba(59,130,246,0.10)',  min: 100,  next: 250   },
  3:  { color: C.green,   bg: C.greenFt,                min: 250,  next: 500   },
  4:  { color: C.gold,    bg: C.goldFt,                 min: 500,  next: 1000  },
  5:  { color: C.orange,  bg: 'rgba(251,146,60,0.10)',  min: 1000, next: 2000  },
  6:  { color: '#F472B6', bg: 'rgba(244,114,182,0.10)', min: 2000, next: 3000  },
  7:  { color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', min: 3000, next: 3750  },
  8:  { color: '#22D3EE', bg: 'rgba(34,211,238,0.10)',  min: 3750, next: 4500  },
  9:  { color: C.red,     bg: C.redFt,                  min: 4500, next: 5000  },
  10: { color: C.geo,     bg: C.geoDim,                 min: 5000, next: null  },
};

function xpPct(xp, level) {
  const cfg = LV[level] || LV[1];
  if (!cfg.next) return 1;
  return Math.min(1, (xp - cfg.min) / (cfg.next - cfg.min));
}

function Skeleton() {
  return (
    <div style={{ padding: '0 16px', animation: 'fadeUp 0.3s ease both' }}>
      {/* XP / profile card */}
      <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: 20, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="sk" style={{ height: 26, width: 120, borderRadius: 7 }} />
          <div className="sk" style={{ height: 26, width: 90, borderRadius: 7 }} />
        </div>
        <div className="sk" style={{ height: 6, borderRadius: 3 }} />
        <div className="sk" style={{ height: 10, width: 60, borderRadius: 5, marginTop: 6 }} />
      </div>
      {/* Task / achievement rows */}
      {[1, 2, 3].map(i => (
        <div key={i} style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="sk" style={{ height: 40, width: 40, borderRadius: '50%' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sk" style={{ height: 13, width: '68%', borderRadius: 6 }} />
            <div className="sk" style={{ height: 10, width: '42%', borderRadius: 5, marginTop: 8 }} />
          </div>
          <div className="sk" style={{ height: 28, width: 68, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}

function ProfileCard({ data }) {
  const { t } = useLanguage();
  const lv     = data.level || 1;
  const cfg    = LV[lv] || LV[1];
  const xp     = data.xp || 0;
  const pct    = xpPct(xp, lv);
  const streak = data.streak?.current_streak || 0;
  const freeze = data.streak?.freeze_available || 0;
  const projected = data.projectedStreak || streak;
  const isMilestone = [7, 14, 30].includes(projected);

  return (
    <div style={{
      ...cardBase,
      border: `0.5px solid ${cfg.color}28`,
      padding: '18px 16px 16px',
      marginBottom: 12,
    }}>
      {/* Level + Streak row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: cfg.bg, borderRadius: 10, padding: '6px 12px',
          border: `0.5px solid ${cfg.color}40`,
        }}>
          <Crown size={13} color={cfg.color} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>
            L{lv} · {t(`level.${lv}`)}
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: streak > 0 ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.04)',
          borderRadius: 10, padding: '6px 12px',
          border: `0.5px solid ${streak > 0 ? 'rgba(251,146,60,0.30)' : C.b1}`,
        }}>
          <Flame size={13} color={streak > 0 ? C.orange : C.t3} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 700, color: streak > 0 ? C.orange : C.t3 }}>
            {streak} {streak % 10 === 1 && streak !== 11 ? 'день' : streak % 10 >= 2 && streak % 10 <= 4 && (streak < 10 || streak > 20) ? 'дня' : 'дней'}
          </span>
        </div>
      </div>

      {/* XP bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {t('game.xp')}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>
            {xp.toLocaleString('ru-RU')}
            {cfg.next ? ` / ${cfg.next.toLocaleString('ru-RU')}` : ` · ${t('game.xp_max')}`}
          </span>
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.round(pct * 100)}%`,
            background: cfg.color,
            borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>
        {cfg.next && (
          <div style={{ fontSize: 11, color: C.t3, marginTop: 5, display: 'flex', justifyContent: 'space-between' }}>
            <span>{freeze > 0 ? t('game.freeze', { n: freeze }) : ''}</span>
            <span>{t('game.xp_to_next', { xp: (cfg.next - xp).toLocaleString('ru-RU'), lv: lv + 1 })}</span>
          </div>
        )}
      </div>

      {isMilestone && streak > 0 && (
        <div style={{
          marginTop: 12,
          background: 'rgba(251,146,60,0.10)', border: `0.5px solid rgba(251,146,60,0.28)`,
          borderRadius: 10, padding: '8px 12px',
          fontSize: 13, color: C.orange, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Star size={13} color={C.orange} strokeWidth={2} />
          {t('game.milestone')}
        </div>
      )}
    </div>
  );
}

const MONO_G = { fontFamily: "'Share Tech Mono', monospace" };

function TaskCard({ task, onClaim, claiming }) {
  const req   = task.requirement || {};
  const total = req.distinct_businesses || req.distinct_categories || req.streak_days || req.checkin_count || req.referral_activated || req.withdrawal_count || 1;
  const prog  = Math.min(task.progress || 0, total);
  const pct   = total > 1 ? prog / total : 0;
  const canClaim = task.completed && !task.claimed;
  const done     = task.claimed;

  return (
    <div style={{
      padding: '11px 0',
      borderBottom: '1px solid rgba(0,200,255,0.07)',
      opacity: done ? 0.45 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 18, height: 18, borderRadius: 2, flexShrink: 0,
          background: done ? `${C.green}18` : canClaim ? C.geoDim : 'rgba(255,255,255,0.04)',
          border: `1px solid ${done ? C.greenGl : canClaim ? C.geoGl : C.b1}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {done
            ? <CheckCircle2 size={10} color={C.green} strokeWidth={2.5} />
            : canClaim
              ? <div style={{ width: 6, height: 6, borderRadius: 1, background: C.geo }} />
              : <div style={{ width: 6, height: 6, borderRadius: 1, background: C.t3, opacity: 0.4 }} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: done ? C.t2 : C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
            <span style={{ ...MONO_G, fontSize: 9, color: C.geo }}>+{task.geo_reward} GEO</span>
            <span style={{ ...MONO_G, fontSize: 8, color: C.t3 }}>·</span>
            <span style={{ ...MONO_G, fontSize: 9, color: C.gold }}>+{task.xp_reward} XP</span>
            {!done && total > 1 && (
              <span style={{ ...MONO_G, fontSize: 9, color: C.t3 }}>{prog}/{total}</span>
            )}
          </div>
          {!done && total > 1 && (
            <div style={{ height: 2, background: 'rgba(0,200,255,0.08)', borderRadius: 99, overflow: 'hidden', marginTop: 5 }}>
              <div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: canClaim ? C.green : C.geo, borderRadius: 99, transition: 'width 0.5s ease' }} />
            </div>
          )}
        </div>
        {canClaim && (
          <button
            onClick={() => onClaim(task.key)}
            disabled={!!claiming}
            style={{
              background: C.geo, color: C.bg, border: 'none',
              borderRadius: 3, padding: '6px 10px',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 9, letterSpacing: 1, cursor: claiming ? 'not-allowed' : 'pointer',
              flexShrink: 0, opacity: claiming ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {claiming && <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />}
            CLAIM
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
            <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              {title}
            </div>
            {items.map(t => <TaskCard key={t.key} task={t} onClaim={onClaim} claiming={claiming === t.key} />)}
          </div>
        );
      })}
    </div>
  );
}

function AchievementCard({ ach }) {
  const { earned } = ach;
  return (
    <div style={{
      ...cardBase,
      border: `0.5px solid ${earned ? 'rgba(245,166,35,0.22)' : C.b0}`,
      padding: '14px 12px',
      opacity: earned ? 1 : 0.45,
      position: 'relative', overflow: 'hidden',
      background: earned ? 'rgba(245,166,35,0.04)' : C.card,
    }}>
      <div style={{ position: 'absolute', top: 8, right: 8 }}>
        {earned
          ? <CheckCircle2 size={13} color={C.gold} strokeWidth={2.5} />
          : <Lock size={12} color={C.t3} strokeWidth={1.75} />
        }
      </div>
      <Trophy size={24} color={earned ? C.gold : C.t3} strokeWidth={1.75} style={{ marginBottom: 10 }} />
      <div style={{ fontWeight: 700, fontSize: 12, color: earned ? C.t1 : C.t2, marginBottom: 4, lineHeight: 1.3, paddingRight: 18 }}>
        {ach.title}
      </div>
      <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.4, marginBottom: 8 }}>
        {ach.description}
      </div>
      {ach.geo_reward > 0 && (
        <div style={{ fontSize: 11, color: C.geo, fontWeight: 700 }}>+{ach.geo_reward} GEO</div>
      )}
      {ach.xp_reward > 0 && (
        <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginTop: 2 }}>+{ach.xp_reward} XP</div>
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
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Получены ({earned.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {earned.map(a => <AchievementCard key={a.key} ach={a} />)}
          </div>
        </div>
      )}
      {locked.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Заблокированы ({locked.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {locked.map(a => <AchievementCard key={a.key} ach={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

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
      <div style={{ ...cardBase, border: `0.5px solid ${C.geoGl}`, padding: '18px 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Ваша реферальная ссылка
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 11,
          padding: '10px 14px', marginBottom: 12,
          fontSize: 13, color: C.t2, wordBreak: 'break-all',
          border: `0.5px solid ${C.b1}`,
        }}>
          {referral?.link || '—'}
        </div>
        <button onClick={copyLink} style={{
          width: '100%',
          background: copied ? C.greenFt : C.geoDim,
          border: `0.5px solid ${copied ? C.greenGl : C.geoGl}`,
          borderRadius: 11, padding: '12px 16px',
          color: copied ? C.green : C.geo,
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s',
        }}>
          {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2} />}
          {copied ? 'Скопировано!' : 'Копировать ссылку'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        {[
          { label: 'Приглашено', value: referral?.totalReferrals || 0,    color: C.t1 },
          { label: 'Активных',   value: referral?.activatedReferrals || 0, color: C.green },
          { label: 'Заработано', value: `${referral?.totalEarned || 0}`,   color: C.geo, sub: 'GEO' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '13px 8px', textAlign: 'center' }}>
            <div style={{ ...SYNE, fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>
              {value}
              {sub && <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 2 }}>{sub}</span>}
            </div>
            <div style={{ fontSize: 10, color: C.t3, marginTop: 4, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div style={{ ...cardBase, border: `0.5px solid ${C.b1}`, padding: '16px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
          Как это работает
        </div>
        {[
          [Gift,       'Поделитесь ссылкой с другом'],
          [Users,      'Друг делает первый чекин в течение 7 дней'],
          [Zap,        'Вы +25 GEO, друг +10 GEO приветственный бонус'],
          [TrendingUp, '+5% от каждого чекина друга в течение 30 дней'],
        ].map(([Icon, text]) => (
          <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: C.geoDim, border: `0.5px solid ${C.geoGl}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={15} color={C.geo} strokeWidth={1.75} />
            </div>
            <span style={{ fontSize: 13, color: C.t2, lineHeight: 1.55, paddingTop: 7 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'tasks',        label: 'Задания',    Icon: Target  },
  { key: 'achievements', label: 'Достижения', Icon: Trophy  },
  { key: 'referral',     label: 'Рефералы',   Icon: Gift    },
];

export default function Game() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('tasks');
  const [claiming, setClaiming] = useState(null);
  const [toast,   setToast]   = useState(null);

  useEffect(() => {
    apiFetch('/api/me/game')
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
      const r = await apiFetch(`/api/me/tasks/${taskKey}/claim`, {
        method: 'POST',
      });
      const body = await r.json();
      if (!r.ok) {
        showToast(body.error === 'ALREADY_CLAIMED' ? 'Уже получено' : 'Не удалось получить', true);
        return;
      }
      showToast(`+${body.geoRewarded} GEO${body.leveledUp ? ' · Новый уровень!' : ''}`);
      setData(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.key === taskKey ? { ...t, claimed: true } : t),
        xp: body.newXp,
        level: body.newLevel,
      }));
    } catch {
      showToast('Ошибка соединения', true);
    } finally {
      setClaiming(null);
    }
  }

  const MONO = { fontFamily: "'Share Tech Mono', monospace" };
  const lv = data?.level || 1;
  const cfg = LV[lv] || LV[1];
  const streak = data?.streak?.current_streak || 0;
  const xp = data?.xp || 0;
  const pct = data ? xpPct(xp, lv) : 0;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, animation: 'pageEnter 0.3s ease both' }}>

      {/* ── Sticky header ── */}
      <div style={{
        background: 'rgba(6,8,14,0.98)',
        borderBottom: '1px solid rgba(0,200,255,0.14)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'sticky', top: 66, zIndex: 10,
        padding: '0 16px',
      }}>
        {/* Level + XP bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, paddingBottom: 8, borderBottom: '1px solid rgba(0,200,255,0.06)' }}>
          <span style={{ ...MONO, fontSize: 9, color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`, borderRadius: 2, padding: '2px 6px' }}>
            L{lv}
          </span>
          <div style={{ flex: 1, height: 3, background: 'rgba(0,200,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
            {!loading && (
              <div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: cfg.color, borderRadius: 99, transition: 'width 0.8s ease' }} />
            )}
          </div>
          <span style={{ ...MONO, fontSize: 9, color: C.t3 }}>
            {xp.toLocaleString('ru-RU')}{cfg.next ? `/${cfg.next.toLocaleString('ru-RU')}` : ''}
          </span>
          <span style={{ ...MONO, fontSize: 9, color: streak > 0 ? C.orange : C.t3, background: streak > 0 ? 'rgba(255,122,48,0.1)' : 'transparent', border: streak > 0 ? '1px solid rgba(255,122,48,0.3)' : 'none', borderRadius: 2, padding: '2px 6px' }}>
            {String(streak).padStart(2, '0')}d
          </span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex' }}>
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)} style={{
                flex: 1, background: 'none', border: 'none',
                padding: '9px 0 8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                cursor: 'pointer',
                borderBottom: `2px solid ${active ? C.geo : 'transparent'}`,
                transition: 'border-color 0.18s',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <Icon size={12} color={active ? C.geo : C.t3} strokeWidth={active ? 2.25 : 1.75} />
                <span style={{ ...MONO, fontSize: 8, color: active ? C.geo : C.t3, letterSpacing: 1.5 }}>
                  {label.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '12px 16px 32px' }}>
        {loading
          ? <Skeleton />
          : !data
            ? (
              <div style={{ textAlign: 'center', paddingTop: 48 }}>
                <div style={{ ...MONO, fontSize: 10, color: C.t3, letterSpacing: 2 }}>LOAD ERROR</div>
              </div>
            )
            : (
              <>
                {tab === 'tasks'        && <TasksTab tasks={data.tasks} onClaim={handleClaim} claiming={claiming} />}
                {tab === 'achievements' && <AchievementsTab achievements={data.achievements} />}
                {tab === 'referral'     && <ReferralTab referral={data.referral} />}
              </>
            )
        }
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%',
          transform: 'translate(-50%, 0)',
          background: toast.isError ? 'rgba(255,56,96,0.12)' : 'rgba(0,200,255,0.10)',
          backdropFilter: 'blur(20px)',
          color: toast.isError ? C.red : C.geo,
          borderRadius: 3, border: `1px solid ${toast.isError ? C.redGl : C.geoGl}`,
          padding: '9px 18px', zIndex: 500, whiteSpace: 'nowrap',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: 11, letterSpacing: 1,
          animation: 'toastIn 0.25s ease',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
