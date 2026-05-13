import { useEffect, useState } from 'react';
import {
  Flame, Trophy, Crown, Gift, Users, Zap, TrendingUp,
  Copy, Check, CheckCircle2, Lock, Loader2, Star, Target,
  Medal, ShieldCheck,
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

function dayWord(n, lang, t) {
  if (lang !== 'ru') return n === 1 ? t('game.day.one') : t('game.day.many');
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return t('game.day.one');
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return t('game.day.few');
  return t('game.day.many');
}

// ── SVG circular progress ring ────────────────────────────────────────────────
function RingProgress({ pct, size = 88, strokeW = 7, color }) {
  const r    = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg
      width={size} height={size}
      style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}
    >
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeW}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={strokeW}
        strokeDasharray={`${circ * Math.min(pct, 1)} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>
      <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '20px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="sk" style={{ width: 88, height: 88, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="sk" style={{ height: 18, width: 120, borderRadius: 8, marginBottom: 8 }} />
            <div className="sk" style={{ height: 12, width: 80,  borderRadius: 6, marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 7 }}>
              <div className="sk" style={{ height: 28, width: 80, borderRadius: 8 }} />
              <div className="sk" style={{ height: 28, width: 60, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          borderRadius: 14, background: C.b0, border: `1px solid ${C.b1}`,
          padding: '12px 14px', marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div className="sk" style={{ width: 32, height: 32, borderRadius: 10 }} />
            <div style={{ flex: 1 }}>
              <div className="sk" style={{ height: 13, width: '60%', borderRadius: 6, marginBottom: 7 }} />
              <div className="sk" style={{ height: 10, width: '35%', borderRadius: 5 }} />
            </div>
            <div className="sk" style={{ height: 30, width: 70, borderRadius: 9 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Player card ───────────────────────────────────────────────────────────────
function PlayerCard({ data }) {
  const { t, lang } = useLanguage();
  const lv     = data.level || 1;
  const cfg    = LV[lv] || LV[1];
  const xp     = data.xp || 0;
  const pct    = xpPct(xp, lv);
  const streak = data.streak?.current_streak || 0;
  const freeze = data.streak?.freeze_available || 0;

  return (
    <div style={{
      ...cardBase,
      border: `1px solid ${cfg.color}32`,
      background: `linear-gradient(145deg, ${cfg.color}0E 0%, ${C.card} 55%)`,
      padding: '20px 18px 17px',
      marginBottom: 20,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* ambient glow */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 130, height: 130, borderRadius: '50%',
        background: `radial-gradient(circle, ${cfg.color}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 17, position: 'relative' }}>
        {/* XP ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <RingProgress pct={pct} size={90} strokeW={7} color={cfg.color} />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 1,
          }}>
            <Crown size={12} color={cfg.color} strokeWidth={2} />
            <span style={{ fontSize: 24, fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{lv}</span>
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.t1, lineHeight: 1.15, marginBottom: 3 }}>
            {t(`level.${lv}`)}
          </div>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 13 }}>
            {xp.toLocaleString('ru-RU')}
            {cfg.next
              ? ` / ${cfg.next.toLocaleString('ru-RU')} XP`
              : ' XP · MAX'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: streak > 0 ? 'rgba(212,135,79,0.14)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${streak > 0 ? 'rgba(212,135,79,0.28)' : C.b1}`,
              borderRadius: 8, padding: '5px 10px',
            }}>
              <Flame size={12} color={streak > 0 ? C.orange : C.t3} strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 700, color: streak > 0 ? C.orange : C.t3 }}>
                {streak}
              </span>
              <span style={{ fontSize: 10, color: C.t3 }}>{dayWord(streak, lang, t)}</span>
            </div>
            {freeze > 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: C.tealDim, border: `1px solid ${C.tealGl}`,
                borderRadius: 8, padding: '5px 10px',
              }}>
                <span style={{ fontSize: 11 }}>❄</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.teal }}>×{freeze}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {cfg.next && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 13, position: 'relative' }}>
          <span style={{ fontSize: 10, color: C.t3 }}>{t('game.to_next_level', { lv: lv + 1 })}</span>
          <span style={{ fontSize: 10, color: cfg.color, fontWeight: 600 }}>
            {t('game.xp_left', { xp: (cfg.next - xp).toLocaleString('ru-RU') })}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onClaim, claiming }) {
  const { t } = useLanguage();
  const req      = task.requirement || {};
  const total    = req.distinct_businesses || req.distinct_categories || req.streak_days
                || req.checkin_count || req.referral_activated || req.withdrawal_count || 1;
  const prog     = Math.min(task.progress || 0, total);
  const pct      = total > 1 ? prog / total : 0;
  const canClaim = task.completed && !task.claimed;
  const done     = task.claimed;

  return (
    <div style={{
      borderRadius: 14,
      background: canClaim
        ? `linear-gradient(135deg, rgba(201,123,71,0.10) 0%, rgba(201,123,71,0.04) 100%)`
        : done ? 'transparent' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${canClaim ? C.geoGl : done ? 'transparent' : 'rgba(255,255,255,0.05)'}`,
      padding: '12px 13px',
      marginBottom: 8,
      opacity: done ? 0.4 : 1,
      transition: 'opacity 0.2s, border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        {/* State icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          background: done ? C.greenFt : canClaim ? C.geoDim : 'rgba(255,255,255,0.04)',
          border: `1px solid ${done ? C.greenGl : canClaim ? C.geoGl : C.b1}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {done
            ? <CheckCircle2 size={14} color={C.green} strokeWidth={2.5} />
            : canClaim
              ? <Star size={14} color={C.geo} strokeWidth={2} />
              : <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.t3, opacity: 0.3 }} />
          }
        </div>

        {/* Text + rewards */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, lineHeight: 1.4, marginBottom: 5 }}>
            {task.title}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.geo, background: C.geoDim, borderRadius: 5, padding: '2px 7px', border: `1px solid ${C.geoGl}` }}>
              +{task.geo_reward} GEO
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.gold, background: C.goldFt, borderRadius: 5, padding: '2px 7px', border: `1px solid ${C.goldGl}` }}>
              +{task.xp_reward} XP
            </span>
            {!done && total > 1 && (
              <span style={{ fontSize: 10, color: C.t3, alignSelf: 'center' }}>
                {prog}/{total}
              </span>
            )}
          </div>
          {!done && total > 1 && (
            <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
              <div style={{
                height: '100%', width: `${Math.round(pct * 100)}%`,
                background: canClaim ? C.green : C.geo,
                borderRadius: 99, transition: 'width 0.5s ease',
              }} />
            </div>
          )}
        </div>

        {/* Claim button */}
        {canClaim && (
          <button
            onClick={() => onClaim(task.key)}
            disabled={!!claiming}
            style={{
              flexShrink: 0, alignSelf: 'center',
              background: C.geo, color: C.bg, border: 'none',
              borderRadius: 9, padding: '8px 12px',
              fontSize: 12, fontWeight: 700,
              cursor: claiming ? 'not-allowed' : 'pointer',
              opacity: claiming ? 0.7 : 1,
              display: 'flex', alignItems: 'center', gap: 4,
              transition: `opacity 0.15s ease`,
            }}
          >
            {claiming && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
            {t('game.claim_btn')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tasks tab ─────────────────────────────────────────────────────────────────
const TASK_GROUPS = [
  { key: 'daily',   tKey: 'game.group.daily',   Icon: Flame,      color: C.orange },
  { key: 'weekly',  tKey: 'game.group.weekly',  Icon: TrendingUp, color: C.teal   },
  { key: 'onetime', tKey: 'game.group.onetime', Icon: Star,       color: C.geo    },
];

function TasksTab({ tasks, onClaim, claiming }) {
  const { t } = useLanguage();
  const all       = tasks || [];
  const claimable = all.filter(tk => tk.completed && !tk.claimed);

  return (
    <div>
      {claimable.length > 0 && (
        <div style={{
          background: `linear-gradient(135deg, ${C.geoDim} 0%, rgba(201,123,71,0.06) 100%)`,
          border: `1px solid ${C.geoGl}`, borderRadius: 14,
          padding: '11px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Star size={13} color={C.geo} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.geo }}>
            {t('game.claimable', { n: claimable.length })}
          </span>
        </div>
      )}

      {TASK_GROUPS.map(({ key, tKey, Icon, color }) => {
        const label = t(tKey);
        const items        = all.filter(tk => tk.type === key);
        if (!items.length) return null;
        const claimedCount = items.filter(tk => tk.claimed).length;
        const groupPct     = items.length ? claimedCount / items.length : 0;

        return (
          <div key={key} style={{ marginBottom: 22 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8,
                  background: `${color}14`, border: `1px solid ${color}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={12} color={color} strokeWidth={2} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 52, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${Math.round(groupPct * 100)}%`,
                    background: color, borderRadius: 99, transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ fontSize: 11, color: C.t3, minWidth: 28, textAlign: 'right' }}>
                  {claimedCount}/{items.length}
                </span>
              </div>
            </div>
            {items.map(t => (
              <TaskCard key={t.key} task={t} onClaim={onClaim} claiming={claiming === t.key} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Badge card ────────────────────────────────────────────────────────────────
function BadgeCard({ ach, index }) {
  const earned = ach.earned;
  return (
    <div style={{
      borderRadius: 16,
      background: earned
        ? `linear-gradient(145deg, ${C.goldFt} 0%, rgba(232,192,104,0.04) 100%)`
        : 'rgba(255,255,255,0.02)',
      border: `1px solid ${earned ? C.goldGl : 'rgba(255,255,255,0.05)'}`,
      padding: '16px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9,
      opacity: earned ? 1 : 0.3,
      animation: `fadeUp 0.24s ease both`,
      animationDelay: `${index * 0.04}s`,
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 50, height: 50, borderRadius: 16,
          background: earned ? C.goldFt : 'rgba(255,255,255,0.04)',
          border: `1px solid ${earned ? C.goldGl : C.b1}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trophy size={23} color={earned ? C.gold : C.t3} strokeWidth={1.5} />
        </div>
        {earned && (
          <div style={{
            position: 'absolute', bottom: -3, right: -3,
            width: 16, height: 16, borderRadius: '50%',
            background: C.green, border: `2px solid ${C.bg}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Check size={7} color={C.bg} strokeWidth={3.5} />
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: earned ? C.t1 : C.t2, lineHeight: 1.35, marginBottom: 3 }}>
          {ach.title}
        </div>
        {earned && (ach.geo_reward > 0 || ach.xp_reward > 0) && (
          <div style={{ fontSize: 10, color: C.gold, fontWeight: 700 }}>
            {ach.geo_reward > 0 && `+${ach.geo_reward} GEO`}
            {ach.geo_reward > 0 && ach.xp_reward > 0 && ' · '}
            {ach.xp_reward > 0 && `+${ach.xp_reward} XP`}
          </div>
        )}
        {!earned && (
          <div style={{
            fontSize: 10, color: C.t3, lineHeight: 1.4,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {ach.description}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Achievements tab ──────────────────────────────────────────────────────────
function AchievementsTab({ achievements }) {
  const { t } = useLanguage();
  const all    = achievements || [];
  const earned = all.filter(a => a.earned);
  const locked = all.filter(a => !a.earned);
  const pct    = all.length ? earned.length / all.length : 0;

  return (
    <div>
      {all.length > 0 && (
        <div style={{
          ...cardBase, border: `1px solid ${C.b1}`,
          padding: '16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <RingProgress pct={pct} size={66} strokeW={5} color={C.gold} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>
                {Math.round(pct * 100)}%
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 3 }}>
              {t('game.ach.progress', { earned: earned.length, total: all.length })}
            </div>
            <div style={{ fontSize: 12, color: C.t3 }}>
              {locked.length > 0
                ? t('game.ach.remaining', { n: locked.length })
                : t('game.ach.done')}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[...earned, ...locked].map((a, i) => (
          <BadgeCard key={a.key} ach={a} index={i} />
        ))}
      </div>
    </div>
  );
}

// ── Referral tab ──────────────────────────────────────────────────────────────
function ReferralTab({ referral }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const link = referral?.link;
    if (!link) return;
    navigator.clipboard?.writeText?.(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: t('game.ref.invited'), value: referral?.totalReferrals || 0,     color: C.t1    },
          { label: t('game.ref.active'),  value: referral?.activatedReferrals || 0, color: C.green },
          { label: t('game.ref.geo'),     value: referral?.totalEarned || 0,        color: C.geo   },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            ...cardBase, border: '1px solid rgba(255,255,255,0.06)',
            padding: '14px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1, letterSpacing: -0.5 }}>
              {value}
            </div>
            <div style={{ fontSize: 10, color: C.t3, marginTop: 5, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Invite card */}
      <div style={{
        borderRadius: 20,
        background: `linear-gradient(135deg, rgba(201,123,71,0.10) 0%, rgba(201,123,71,0.04) 100%)`,
        border: `1px solid ${C.geoGl}`,
        padding: '18px', marginBottom: 12,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -28, right: -28, width: 110, height: 110, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(201,123,71,0.13) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ fontSize: 11, fontWeight: 700, color: C.geo, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
          {t('game.ref.link_label')}
        </div>
        <div style={{
          background: 'rgba(0,0,0,0.22)', borderRadius: 10,
          padding: '10px 12px', marginBottom: 12,
          fontSize: 12, color: C.t2, wordBreak: 'break-all',
          border: `1px solid rgba(255,255,255,0.07)`, lineHeight: 1.5,
          fontFamily: 'monospace',
        }}>
          {referral?.link || '—'}
        </div>
        <button
          onClick={copyLink}
          style={{
            width: '100%', borderRadius: 12, padding: '13px',
            background: copied ? C.greenFt : C.geo,
            border: copied ? `1px solid ${C.greenGl}` : 'none',
            color: copied ? C.green : C.bg,
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
        >
          {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2} />}
          {copied ? t('game.ref.copied') : t('game.ref.copy')}
        </button>
      </div>

      {/* Timeline steps */}
      <div style={{ ...cardBase, border: '1px solid rgba(255,255,255,0.06)', padding: '18px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 18 }}>
          {t('game.ref.how_title')}
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 16, top: 16, bottom: 8,
            width: 1, background: 'rgba(255,255,255,0.06)',
          }} />
          {[
            { Icon: Gift,       text: t('game.ref.step1'), color: C.geo   },
            { Icon: Users,      text: t('game.ref.step2'), color: C.teal  },
            { Icon: Zap,        text: t('game.ref.step3'), color: C.gold  },
            { Icon: TrendingUp, text: t('game.ref.step4'), color: C.green },
          ].map(({ Icon, text, color }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < 3 ? 16 : 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                background: `${color}14`, border: `1px solid ${color}28`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', zIndex: 1,
              }}>
                <Icon size={14} color={color} strokeWidth={1.75} />
              </div>
              <span style={{ fontSize: 13, color: C.t2, lineHeight: 1.55, paddingTop: 7 }}>
                {text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tabs config ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'tasks',        tKey: 'game.tab.tasks',        Icon: Target  },
  { key: 'achievements', tKey: 'game.tab.achievements', Icon: Trophy  },
  { key: 'referral',     tKey: 'game.tab.referral',     Icon: Users   },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Game() {
  const { t } = useLanguage();
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
        showToast(body.error === 'ALREADY_CLAIMED' ? t('game.err.claimed') : t('game.err.claim_fail'), true);
        return;
      }
      showToast(`+${body.geoRewarded} GEO${body.leveledUp ? ` · ${t('level.' + body.newLevel)}!` : ''}`);
      setData(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.key === taskKey ? { ...t, claimed: true } : t),
        xp:    body.newXp,
        level: body.newLevel,
      }));
    } catch {
      showToast(t('game.err.connection'), true);
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, animation: 'pageEnter 0.3s ease both' }}>

      {/* ── Content ── */}
      <div style={{ padding: '16px 16px 40px' }}>
        {loading ? (
          <Skeleton />
        ) : !data ? (
          <div style={{ textAlign: 'center', paddingTop: 56 }}>
            <div style={{ fontSize: 13, color: C.t3 }}>{t('game.err.load')}</div>
          </div>
        ) : (
          <>
            <PlayerCard data={data} />

            {/* ── Segment tab switcher ── */}
            <div style={{ background: C.surf, borderRadius: 14, padding: 4, display: 'flex', gap: 2, marginBottom: 20 }}>
              {TABS.map(({ key, tKey, Icon }) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    style={{
                      flex: 1, border: 'none', cursor: 'pointer',
                      background: active ? C.cardHi : 'transparent',
                      borderRadius: 11,
                      padding: '9px 6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      transition: `background 0.2s ${E.smooth}`,
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <Icon size={13} color={active ? C.geo : C.t3} strokeWidth={active ? 2.25 : 1.75} />
                    <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? C.geo : C.t3 }}>
                      {t(tKey)}
                    </span>
                  </button>
                );
              })}
            </div>

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
