import { useEffect, useState } from 'react';
import {
  Flame, Trophy, Crown, Gift, Users, Zap, TrendingUp,
  Copy, Check, CheckCircle2, Lock, Loader2, Star, Target,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { C, cardBase, E } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';

// ── Level config ──────────────────────────────────────────────────────────────
const LV = {
  1:  { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', min: 0,    next: 100   },
  2:  { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  min: 100,  next: 250   },
  3:  { color: C.green,   bg: C.greenFt,                min: 250,  next: 500   },
  4:  { color: C.gold,    bg: C.goldFt,                 min: 500,  next: 1000  },
  5:  { color: C.orange,  bg: 'rgba(212,135,79,0.12)',  min: 1000, next: 2000  },
  6:  { color: '#F472B6', bg: 'rgba(244,114,182,0.12)', min: 2000, next: 3000  },
  7:  { color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', min: 3000, next: 3750  },
  8:  { color: '#22D3EE', bg: 'rgba(34,211,238,0.12)',  min: 3750, next: 4500  },
  9:  { color: C.red,     bg: C.redFt,                  min: 4500, next: 5000  },
  10: { color: C.geo,     bg: C.geoDim,                 min: 5000, next: null  },
};

function xpPct(xp, level) {
  const cfg = LV[level] || LV[1];
  if (!cfg.next) return 1;
  return Math.min(1, (xp - cfg.min) / (cfg.next - cfg.min));
}

function pluralDays(n) {
  if (n % 10 === 1 && n !== 11) return 'день';
  if (n % 10 >= 2 && n % 10 <= 4 && (n < 10 || n > 20)) return 'дня';
  return 'дней';
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>
      {/* Progress banner */}
      <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className="sk" style={{ width: 42, height: 42, borderRadius: 13 }} />
          <div style={{ flex: 1 }}>
            <div className="sk" style={{ height: 15, width: 100, borderRadius: 6, marginBottom: 6 }} />
            <div className="sk" style={{ height: 11, width: 60, borderRadius: 5 }} />
          </div>
          <div className="sk" style={{ height: 34, width: 72, borderRadius: 10 }} />
        </div>
        <div className="sk" style={{ height: 6, borderRadius: 99 }} />
        <div className="sk" style={{ height: 10, width: 140, borderRadius: 5, marginTop: 7 }} />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="sk" style={{ width: 36, height: 36, borderRadius: 11 }} />
          <div style={{ flex: 1 }}>
            <div className="sk" style={{ height: 13, width: '60%', borderRadius: 6, marginBottom: 7 }} />
            <div className="sk" style={{ height: 10, width: '38%', borderRadius: 5 }} />
          </div>
          <div className="sk" style={{ height: 32, width: 76, borderRadius: 10 }} />
        </div>
      ))}
    </div>
  );
}

// ── Progress banner (level + XP + streak) ─────────────────────────────────────
function ProgressBanner({ data }) {
  const { t } = useLanguage();
  const lv     = data.level || 1;
  const cfg    = LV[lv] || LV[1];
  const xp     = data.xp || 0;
  const pct    = xpPct(xp, lv);
  const streak = data.streak?.current_streak || 0;
  const freeze = data.streak?.freeze_available || 0;
  const isMilestone = [7, 14, 30].includes(streak) && streak > 0;

  return (
    <div style={{
      ...cardBase,
      border: `1px solid ${cfg.color}28`,
      background: `linear-gradient(135deg, ${cfg.color}08 0%, ${C.card} 65%)`,
      padding: '16px', marginBottom: 20,
    }}>
      {/* Level + streak */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: cfg.bg, border: `1px solid ${cfg.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Crown size={19} color={cfg.color} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: cfg.color, lineHeight: 1.1 }}>
              Уровень {lv}
            </div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>
              {t(`level.${lv}`)}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: streak > 0 ? 'rgba(212,135,79,0.12)' : C.b0,
          borderRadius: 12, padding: '8px 12px',
          border: `1px solid ${streak > 0 ? 'rgba(212,135,79,0.28)' : C.b1}`,
        }}>
          <Flame size={15} color={streak > 0 ? C.orange : C.t3} strokeWidth={2} />
          <span style={{ fontSize: 15, fontWeight: 700, color: streak > 0 ? C.orange : C.t3 }}>
            {streak}
            <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 3 }}>{pluralDays(streak)}</span>
          </span>
        </div>
      </div>

      {/* XP bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.t3 }}>Опыт</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>
          {xp.toLocaleString('ru-RU')}
          {cfg.next
            ? <span style={{ color: C.t3, fontWeight: 400 }}> / {cfg.next.toLocaleString('ru-RU')}</span>
            : <span style={{ color: C.t3, fontWeight: 400 }}> · MAX</span>}
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: `linear-gradient(90deg, ${cfg.color}BB, ${cfg.color})`, borderRadius: 99, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {freeze > 0
          ? <span style={{ fontSize: 11, color: C.teal }}>❄ Заморозка ×{freeze}</span>
          : <span />}
        {cfg.next && (
          <span style={{ fontSize: 11, color: C.t3 }}>
            ещё {(cfg.next - xp).toLocaleString('ru-RU')} XP до ур. {lv + 1}
          </span>
        )}
      </div>

      {isMilestone && (
        <div style={{ marginTop: 12, background: 'rgba(212,135,79,0.10)', border: '1px solid rgba(212,135,79,0.25)', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: C.orange, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Star size={14} color={C.orange} strokeWidth={2} />
          {t('game.milestone')}
        </div>
      )}
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onClaim, claiming }) {
  const req   = task.requirement || {};
  const total = req.distinct_businesses || req.distinct_categories || req.streak_days || req.checkin_count || req.referral_activated || req.withdrawal_count || 1;
  const prog  = Math.min(task.progress || 0, total);
  const pct   = total > 1 ? prog / total : 0;
  const canClaim = task.completed && !task.claimed;
  const done     = task.claimed;

  let iconBg     = 'rgba(255,255,255,0.04)';
  let iconBorder = C.b1;
  let StateIcon  = null;
  let iconColor  = C.t3;
  if (done)      { iconBg = C.greenFt; iconBorder = C.greenGl; StateIcon = CheckCircle2; iconColor = C.green; }
  else if (canClaim) { iconBg = C.geoDim;  iconBorder = C.geoGl;  StateIcon = Star;        iconColor = C.geo; }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
      opacity: done ? 0.46 : 1, transition: 'opacity 0.2s',
    }}>
      {/* State icon */}
      <div style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, background: iconBg, border: `1px solid ${iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {StateIcon
          ? <StateIcon size={16} color={iconColor} strokeWidth={2.25} />
          : <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.t3, opacity: 0.28 }} />}
      </div>

      {/* Text + rewards */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: done ? C.t2 : C.t1, lineHeight: 1.35, marginBottom: 6 }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.geo, background: C.geoDim, borderRadius: 6, padding: '2px 8px', border: `1px solid ${C.geoGl}` }}>
            +{task.geo_reward} GEO
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, background: C.goldFt, borderRadius: 6, padding: '2px 8px', border: `1px solid ${C.goldGl}` }}>
            +{task.xp_reward} XP
          </span>
          {!done && total > 1 && (
            <span style={{ fontSize: 11, color: C.t3, alignSelf: 'center' }}>{prog} / {total}</span>
          )}
        </div>
        {!done && total > 1 && (
          <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: canClaim ? C.green : C.geo, borderRadius: 99, transition: 'width 0.5s ease' }} />
          </div>
        )}
      </div>

      {/* Claim */}
      {canClaim && (
        <button
          onClick={() => onClaim(task.key)}
          disabled={!!claiming}
          style={{
            flexShrink: 0, alignSelf: 'center',
            background: C.geo, color: C.bg, border: 'none',
            borderRadius: 10, padding: '8px 14px',
            fontSize: 13, fontWeight: 700,
            cursor: claiming ? 'not-allowed' : 'pointer',
            opacity: claiming ? 0.7 : 1,
            display: 'flex', alignItems: 'center', gap: 5,
            transition: `opacity 0.15s ${E.smooth}`,
          }}
        >
          {claiming && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
          Получить
        </button>
      )}
    </div>
  );
}

// ── Tasks tab ─────────────────────────────────────────────────────────────────
const TASK_GROUPS = [
  { key: 'daily',   label: 'Ежедневные',   Icon: Flame,      color: C.orange },
  { key: 'weekly',  label: 'Еженедельные', Icon: TrendingUp, color: C.teal   },
  { key: 'onetime', label: 'Разовые',      Icon: Star,       color: C.geo    },
];

function TasksTab({ tasks, onClaim, claiming }) {
  const allTasks = tasks || [];
  const totalClaimable = allTasks.filter(t => t.completed && !t.claimed).length;

  return (
    <div>
      {totalClaimable > 0 && (
        <div style={{ background: C.geoDim, border: `1px solid ${C.geoGl}`, borderRadius: 14, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={14} color={C.geo} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.geo }}>
            {totalClaimable} {totalClaimable === 1 ? 'задание готово' : 'задания готовы'} к получению
          </span>
        </div>
      )}

      {TASK_GROUPS.map(({ key, label, Icon, color }) => {
        const items = allTasks.filter(t => t.type === key);
        if (!items.length) return null;
        const claimedCount = items.filter(t => t.claimed).length;
        return (
          <div key={key} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2, paddingBottom: 8, borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 3, height: 14, background: color, borderRadius: 2 }} />
                <Icon size={13} color={color} strokeWidth={2} />
                <span style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: 0.3 }}>{label}</span>
              </div>
              <span style={{ fontSize: 11, color: C.t3 }}>{claimedCount}/{items.length}</span>
            </div>
            {items.map(t => <TaskCard key={t.key} task={t} onClaim={onClaim} claiming={claiming === t.key} />)}
          </div>
        );
      })}
    </div>
  );
}

// ── Achievement card ───────────────────────────────────────────────────────────
function AchievementCard({ ach, index }) {
  const { earned } = ach;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
      animation: `fadeUp 0.24s ease both`,
      animationDelay: `${index * 0.04}s`,
    }}>
      {/* Icon with status badge */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: earned ? C.goldFt : C.b0, border: `1px solid ${earned ? C.goldGl : C.b1}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: earned ? 1 : 0.45 }}>
          <Trophy size={20} color={earned ? C.gold : C.t3} strokeWidth={1.75} />
        </div>
        <div style={{ position: 'absolute', bottom: -3, right: -3, width: 17, height: 17, borderRadius: '50%', background: earned ? C.green : C.surf, border: `2px solid ${C.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {earned
            ? <Check size={8} color={C.bg} strokeWidth={3.5} />
            : <Lock size={7} color={C.t3} strokeWidth={2.5} />}
        </div>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, opacity: earned ? 1 : 0.55 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: earned ? C.t1 : C.t2, marginBottom: 3 }}>
          {ach.title}
        </div>
        <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {ach.description}
        </div>
      </div>

      {/* Reward */}
      <div style={{ flexShrink: 0, textAlign: 'right', opacity: earned ? 1 : 0.5 }}>
        {ach.geo_reward > 0 && (
          <div style={{ fontSize: 13, fontWeight: 700, color: C.geo }}>+{ach.geo_reward}</div>
        )}
        {ach.xp_reward > 0 && (
          <div style={{ fontSize: 11, fontWeight: 600, color: C.gold, marginTop: 2 }}>+{ach.xp_reward} XP</div>
        )}
        {!ach.geo_reward && !ach.xp_reward && (
          <div style={{ fontSize: 11, color: C.t3 }}>—</div>
        )}
      </div>
    </div>
  );
}

// ── Achievements tab ──────────────────────────────────────────────────────────
function AchievementsTab({ achievements }) {
  const all    = achievements || [];
  const earned = all.filter(a => a.earned);
  const locked = all.filter(a => !a.earned);
  const pct    = all.length > 0 ? Math.round((earned.length / all.length) * 100) : 0;

  return (
    <div>
      {/* Progress summary */}
      {all.length > 0 && (
        <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>Получено достижений</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>{earned.length} / {all.length}</span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.gold}BB, ${C.gold})`, borderRadius: 99, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginTop: 5, textAlign: 'right' }}>{pct}% выполнено</div>
        </div>
      )}

      {earned.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8, marginBottom: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: 3, height: 13, background: C.gold, borderRadius: 2 }} />
            <Trophy size={12} color={C.gold} strokeWidth={2} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.gold }}>Получены</span>
            <span style={{ fontSize: 11, color: C.t3, marginLeft: 'auto' }}>{earned.length}</span>
          </div>
          {earned.map((a, i) => <AchievementCard key={a.key} ach={a} index={i} />)}
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8, marginBottom: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: 3, height: 13, background: C.t3, borderRadius: 2 }} />
            <Lock size={12} color={C.t3} strokeWidth={2} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.t3 }}>Заблокированы</span>
            <span style={{ fontSize: 11, color: C.t3, marginLeft: 'auto' }}>{locked.length}</span>
          </div>
          {locked.map((a, i) => <AchievementCard key={a.key} ach={a} index={i} />)}
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
    navigator.clipboard?.writeText?.(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  const stats = [
    { label: 'Приглашено',  value: referral?.totalReferrals     || 0, color: C.t1,   unit: null  },
    { label: 'Активных',    value: referral?.activatedReferrals || 0, color: C.green, unit: null  },
    { label: 'Заработано',  value: referral?.totalEarned        || 0, color: C.geo,  unit: 'GEO' },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        {stats.map(({ label, value, color, unit }) => (
          <div key={label} style={{ ...cardBase, border: '1px solid rgba(255,255,255,0.06)', padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1, letterSpacing: -0.5 }}>
              {value}
            </div>
            {unit && <div style={{ fontSize: 9, fontWeight: 700, color, opacity: 0.7, marginTop: 1 }}>{unit}</div>}
            <div style={{ fontSize: 10, color: C.t3, marginTop: 5, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Copy link */}
      <div style={{ ...cardBase, border: `1px solid ${C.geoGl}`, padding: '16px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          Реферальная ссылка
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: C.t2, wordBreak: 'break-all', border: `1px solid ${C.b1}`, lineHeight: 1.5 }}>
          {referral?.link || '—'}
        </div>
        <button
          onClick={copyLink}
          style={{
            width: '100%', border: 'none', borderRadius: 12, padding: '13px',
            background: copied ? C.greenFt : C.geo,
            border: copied ? `1px solid ${C.greenGl}` : 'none',
            color: copied ? C.green : C.bg,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
        >
          {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2} />}
          {copied ? 'Скопировано!' : 'Скопировать ссылку'}
        </button>
      </div>

      {/* How it works */}
      <div style={{ ...cardBase, border: '1px solid rgba(255,255,255,0.06)', padding: '16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
          Как это работает
        </div>
        {[
          [Gift,       '+25 GEO вам и +10 GEO другу после первого чекина',   C.geo   ],
          [Users,      'Друг должен сделать чекин в течение 7 дней',          C.teal  ],
          [Zap,        'Бонус начисляется автоматически',                     C.gold  ],
          [TrendingUp, '+5% от каждого чекина друга в течение 30 дней',       C.green ],
        ].map(([Icon, text, color], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < 3 ? 12 : 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, background: `${color}18`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={16} color={color} strokeWidth={1.75} />
            </div>
            <span style={{ fontSize: 13, color: C.t2, lineHeight: 1.55, paddingTop: 8 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tabs config ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'tasks',        label: 'Задания',    Icon: Target  },
  { key: 'achievements', label: 'Достижения', Icon: Trophy  },
  { key: 'referral',     label: 'Рефералы',   Icon: Gift    },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Game() {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('tasks');
  const [claiming, setClaiming] = useState(null);
  const [toast,    setToast]    = useState(null);

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
      const r    = await apiFetch(`/api/me/tasks/${taskKey}/claim`, { method: 'POST' });
      const body = await r.json();
      if (!r.ok) {
        showToast(body.error === 'ALREADY_CLAIMED' ? 'Уже получено' : 'Не удалось получить', true);
        return;
      }
      showToast(`+${body.geoRewarded} GEO${body.leveledUp ? ' · Новый уровень!' : ''}`);
      setData(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.key === taskKey ? { ...t, claimed: true } : t),
        xp:    body.newXp,
        level: body.newLevel,
      }));
    } catch {
      showToast('Ошибка соединения', true);
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, animation: 'pageEnter 0.3s ease both' }}>

      {/* ── Sticky tabs ── */}
      <div style={{
        background: 'rgba(8,16,24,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        position: 'sticky', top: 66, zIndex: 10,
        display: 'flex', padding: '0 16px',
      }}>
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)} style={{
              flex: 1, background: 'none', border: 'none',
              padding: '12px 0 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              cursor: 'pointer',
              borderBottom: `2.5px solid ${active ? C.geo : 'transparent'}`,
              transition: `border-color 0.18s ${E.smooth}`,
              WebkitTapHighlightColor: 'transparent',
            }}>
              <Icon size={14} color={active ? C.geo : C.t3} strokeWidth={active ? 2.25 : 1.75} />
              <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? C.geo : C.t3 }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '16px 16px 40px' }}>
        {loading ? (
          <Skeleton />
        ) : !data ? (
          <div style={{ textAlign: 'center', paddingTop: 56 }}>
            <div style={{ fontSize: 13, color: C.t3 }}>Не удалось загрузить данные</div>
          </div>
        ) : (
          <>
            <ProgressBanner data={data} />
            {tab === 'tasks'        && <TasksTab tasks={data.tasks} onClaim={handleClaim} claiming={claiming} />}
            {tab === 'achievements' && <AchievementsTab achievements={data.achievements} />}
            {tab === 'referral'     && <ReferralTab referral={data.referral} />}
          </>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 88, left: '50%',
          transform: 'translate(-50%, 0)',
          background: toast.isError ? C.redFt : C.geoDim,
          backdropFilter: 'blur(20px)',
          color: toast.isError ? C.red : C.geo,
          borderRadius: 12, border: `1px solid ${toast.isError ? C.redGl : C.geoGl}`,
          padding: '11px 22px', zIndex: 500, whiteSpace: 'nowrap',
          fontSize: 13, fontWeight: 600,
          animation: 'toastIn 0.25s ease',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
