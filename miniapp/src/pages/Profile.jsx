import { useEffect, useState } from 'react';
import { Crown, Flame, MapPin as MapPinIcon } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { C, cardBase, E } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';
import { LANGS } from '../lib/i18n';
import { user } from '../hooks/useTelegram';

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

function RingProgress({ pct, size = 56, strokeW = 5, color }) {
  const r    = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth={strokeW} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeW}
        strokeDasharray={`${circ * Math.min(pct, 1)} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
    </svg>
  );
}

function Skel({ h = 16, w = '100%', r = 8 }) {
  return <div className="sk" style={{ height: h, width: w, borderRadius: r }} />;
}

export default function Profile() {
  const { t, lang, setLang } = useLanguage();
  const [meData,   setMeData]   = useState(null);
  const [gameData, setGameData] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/me').then(r => r.ok ? r.json() : null).catch(() => null),
      apiFetch('/api/me/game').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([me, game]) => {
      setMeData(me);
      setGameData(game);
    }).finally(() => setLoading(false));
  }, []);

  const balance = meData?.user?.balance ?? 0;
  const visits  = meData?.user?.total_visits ?? meData?.user?.checkin_count ?? 0;
  const level   = gameData?.level ?? 1;
  const xp      = gameData?.xp ?? 0;
  const streak  = gameData?.streak?.current_streak ?? 0;
  const cfg     = LV[level] || LV[1];
  const pct     = xpPct(xp, level);

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ')
    : 'GeoEarn User';
  const username = user?.username ? `@${user.username}` : null;
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '16px 16px 40px', animation: 'pageEnter 0.3s ease both' }}>

      {/* ── User hero card ── */}
      <div style={{
        ...cardBase,
        border: `1px solid ${cfg.color}30`,
        background: `linear-gradient(145deg, ${cfg.color}0E 0%, ${C.card} 60%)`,
        padding: '20px',
        marginBottom: 14,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -24, right: -24,
          width: 120, height: 120, borderRadius: '50%',
          background: `radial-gradient(circle, ${cfg.color}10 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
          {/* Avatar */}
          <div style={{
            width: 68, height: 68, borderRadius: 20, flexShrink: 0,
            background: cfg.bg, border: `1.5px solid ${cfg.color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: cfg.color }}>{initials}</span>
          </div>

          {/* Name + level */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <>
                <Skel h={18} w={130} r={8} />
                <div style={{ marginTop: 6 }}><Skel h={12} w={80} r={6} /></div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.t1, lineHeight: 1.2, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
                {username && (
                  <div style={{ fontSize: 12, color: C.t3, marginBottom: 9 }}>{username}</div>
                )}
              </>
            )}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: cfg.bg, border: `1px solid ${cfg.color}32`,
              borderRadius: 8, padding: '4px 10px',
            }}>
              <Crown size={11} color={cfg.color} strokeWidth={2} />
              <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>
                {t(`level.${level}`)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── XP + Streak ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {/* XP */}
        <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <RingProgress pct={pct} size={54} strokeW={5} color={cfg.color} />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: cfg.color }}>{level}</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.t3, marginBottom: 3 }}>XP</div>
              {loading
                ? <Skel h={16} w={60} r={6} />
                : <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, lineHeight: 1 }}>
                    {xp.toLocaleString('ru-RU')}
                    {cfg.next && (
                      <span style={{ fontSize: 10, color: C.t3, fontWeight: 400 }}>
                        {' '}/ {cfg.next.toLocaleString('ru-RU')}
                      </span>
                    )}
                  </div>
              }
            </div>
          </div>
        </div>

        {/* Streak */}
        <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Flame size={16} color={streak > 0 ? C.orange : C.t3} strokeWidth={2} />
            {loading
              ? <Skel h={24} w={40} r={6} />
              : <span style={{ fontSize: 24, fontWeight: 800, color: streak > 0 ? C.orange : C.t3, letterSpacing: -0.5, lineHeight: 1 }}>
                  {streak}
                </span>
            }
          </div>
          <div style={{ fontSize: 10, color: C.t3 }}>{t('hdr.streak')}</div>
        </div>
      </div>

      {/* ── Balance + Visits ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px' }}>
          {loading
            ? <Skel h={22} w={80} r={6} />
            : <div style={{ fontSize: 22, fontWeight: 800, color: C.geo, letterSpacing: -0.5, lineHeight: 1 }}>
                {balance.toLocaleString('ru-RU')}
              </div>
          }
          <div style={{ fontSize: 9, fontWeight: 700, color: C.geo, opacity: 0.7, marginTop: 1 }}>GEO</div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 5 }}>{t('hdr.balance')}</div>
        </div>
        <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '14px' }}>
          {loading
            ? <Skel h={22} w={50} r={6} />
            : <div style={{ fontSize: 22, fontWeight: 800, color: C.teal, letterSpacing: -0.5, lineHeight: 1 }}>
                {visits}
              </div>
          }
          <div style={{ fontSize: 10, color: C.t3, marginTop: 6 }}>{t('balance.visits')}</div>
        </div>
      </div>

      {/* ── Language ── */}
      <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
          {t('lang.title')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(LANGS).map(([code, info]) => {
            const active = lang === code;
            return (
              <button
                key={code}
                onClick={() => setLang(code)}
                style={{
                  flex: 1, borderRadius: 10, padding: '11px 0',
                  border: `1px solid ${active ? C.geo : C.b2}`,
                  background: active ? C.geoDim : 'transparent',
                  color: active ? C.geo : C.t3,
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transition: `all 0.15s ${E.smooth}`,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {info.short}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
