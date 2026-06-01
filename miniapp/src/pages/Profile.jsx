import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown, Flame, MessageCircle, AlertCircle, Send,
  CheckCircle, X, Loader2, Shield, ChevronRight, Store,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatGeo } from '../lib/geo';
import { C, E, FF } from '../lib/design';
import { useLanguage } from '../contexts/LanguageContext';
import { LANGS } from '../lib/i18n';
import { user } from '../hooks/useTelegram';

// ── Easing ────────────────────────────────────────────────────────────────────
const EASE_OUT = 'cubic-bezier(0.23,1,0.32,1)';
const EASE_SPRING = 'cubic-bezier(0.32,0.72,0,1)';

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

// ── Ring progress ─────────────────────────────────────────────────────────────
function RingProgress({ pct, size = 60, strokeW = 4, color }) {
  const r    = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth={strokeW} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeW}
        strokeDasharray={`${circ * Math.min(pct, 1)} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1) 0.15s' }} />
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skel({ h = 16, w = '100%', r = 8 }) {
  return <div className="sk" style={{ height: h, width: w, borderRadius: r }} />;
}

// ── Support sheet ─────────────────────────────────────────────────────────────
function SupportSheet({ onClose }) {
  const { t } = useLanguage();
  const [type,       setType]       = useState('chat');
  const [message,    setMessage]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent,       setSent]       = useState(false);
  const [err,        setErr]        = useState('');
  const textareaRef = useRef(null);

  useEffect(() => { setTimeout(() => textareaRef.current?.focus(), 80); }, []);

  async function handleSend() {
    if (message.trim().length < 3) { setErr(t('support.err.short')); return; }
    setErr(''); setSubmitting(true);
    try {
      const r = await apiFetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message: message.trim() }),
      });
      if (!r.ok) throw new Error('fail');
      setSent(true);
    } catch {
      setErr(t('support.err.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        zIndex: 200, animation: 'backdropIn 0.2s cubic-bezier(0.22,1,0.36,1)',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(180deg,#141E2A 0%,#101A24 100%)',
        borderRadius: '26px 26px 0 0',
        border: '0.5px solid rgba(255,255,255,0.10)', borderBottom: 'none',
        padding: '0 0 40px', zIndex: 201, maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.34s cubic-bezier(0.22,1,0.36,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.10)', margin: '14px auto 20px' }} />
        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.t1, letterSpacing: -0.4 }}>
              {t('support.title')}
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer',
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <X size={14} color={C.t3} />
            </button>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: C.geoDim, border: `1px solid ${C.geoGl}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <CheckCircle size={28} color={C.geo} strokeWidth={2} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 8, letterSpacing: -0.3 }}>
                {t('support.sent')}
              </div>
              <div style={{ fontSize: 13, color: C.t3, marginBottom: 22, lineHeight: 1.55 }}>
                {t('support.sent_sub')}
              </div>
              <button onClick={onClose} style={{
                background: C.geo, color: '#0A0E14', border: 'none',
                borderRadius: 14, padding: '13px 36px',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}>
                {t('support.close')}
              </button>
            </div>
          ) : (
            <>
              {/* Type toggle */}
              <div style={{
                display: 'flex', gap: 8, marginBottom: 16,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, padding: 4,
              }}>
                {[
                  { key: 'chat',   label: t('support.type.chat') },
                  { key: 'report', label: t('support.type.report') },
                ].map(({ key, label }) => {
                  const active = type === key;
                  return (
                    <button key={key} onClick={() => setType(key)} style={{
                      flex: 1, padding: '9px 0', borderRadius: 11,
                      border: 'none',
                      background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: active ? C.t1 : C.t3,
                      fontSize: 13, fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                      transition: `background 0.15s ${EASE_OUT}, color 0.15s`,
                      WebkitTapHighlightColor: 'transparent',
                    }}>
                      {label}
                    </button>
                  );
                })}
              </div>

              <textarea
                ref={textareaRef}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={t('support.placeholder')}
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '13px 14px', borderRadius: 14,
                  border: `1px solid ${err ? C.red : 'rgba(255,255,255,0.10)'}`,
                  background: 'rgba(255,255,255,0.04)',
                  color: C.t1, fontSize: 14, outline: 'none',
                  resize: 'none', lineHeight: 1.55,
                  transition: 'border-color 0.15s',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ fontSize: 10, color: C.t3, textAlign: 'right', marginTop: 4, marginBottom: err ? 4 : 12 }}>
                {message.length}/2000
              </div>

              {err && (
                <div style={{
                  fontSize: 13, color: C.red, fontWeight: 600, marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <AlertCircle size={13} color={C.red} /> {err}
                </div>
              )}

              <button
                onClick={handleSend}
                disabled={submitting || message.trim().length < 3}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                  background: (submitting || message.trim().length < 3)
                    ? 'rgba(255,255,255,0.06)'
                    : 'linear-gradient(135deg,#D48A52 0%,#C97B47 100%)',
                  color: (submitting || message.trim().length < 3) ? C.t3 : '#0A0E14',
                  fontSize: 14, fontWeight: 700,
                  cursor: (submitting || message.trim().length < 3) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: `all 0.18s ${EASE_OUT}`,
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: (submitting || message.trim().length < 3)
                    ? 'none'
                    : '0 4px 18px rgba(201,123,71,0.28)',
                }}
              >
                {submitting
                  ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {t('support.sending')}</>
                  : <><Send size={15} strokeWidth={2} /> {t('support.send')}</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Pressable row ─────────────────────────────────────────────────────────────
function PressableRow({ onClick, children, style = {} }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        transform: pressed ? 'scale(0.985)' : 'scale(1)',
        transition: pressed
          ? `transform 90ms ${EASE_OUT}`
          : `transform 160ms ${EASE_SPRING}`,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Main Profile page ─────────────────────────────────────────────────────────
export default function Profile() {
  const { t, lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [meData,      setMeData]      = useState(null);
  const [gameData,    setGameData]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [supportOpen, setSupportOpen] = useState(false);

  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/me').then(r => r.ok ? r.json() : null).catch(() => null),
      apiFetch('/api/me/game').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([me, game]) => {
      setMeData(me);
      setGameData(game);
    }).finally(() => setLoading(false));

    apiFetch('/api/admin/business')
      .then(r => setIsOwner(r.status === 200))
      .catch(() => {});
  }, []);

  const isSuperAdmin = meData?.is_super_admin || false;
  const balance  = meData?.user?.balance ?? 0;
  const visits   = meData?.user?.total_visits ?? meData?.user?.checkin_count ?? 0;
  const level    = gameData?.level ?? 1;
  const xp       = gameData?.xp ?? 0;
  const streak   = gameData?.streak?.current_streak ?? 0;
  const cfg      = LV[level] || LV[1];
  const pct      = xpPct(xp, level);

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ')
    : 'GeoEarn User';
  const username = user?.username ? `@${user.username}` : null;
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      padding: '20px 16px 80px',
      animation: 'pageEnter 0.35s cubic-bezier(0.22,1,0.36,1) both',
    }}>

      {/* ── Identity card ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 20, padding: 1.5, marginBottom: 12,
      }}>
        <div style={{
          background: `linear-gradient(145deg, ${cfg.color}09 0%, #0E1C2A 60%, #081018 100%)`,
          borderRadius: 19, padding: '20px',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Subtle accent blob */}
          <div style={{
            position: 'absolute', top: -30, right: -20,
            width: 140, height: 140, borderRadius: '50%',
            background: `radial-gradient(circle, ${cfg.color}10 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
            {/* Avatar with ring */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <RingProgress pct={pct} size={62} strokeW={3.5} color={cfg.color} />
              {/* Level number in center of ring */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%',
                  background: cfg.bg, border: `1px solid ${cfg.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: cfg.color, letterSpacing: -0.3 }}>
                    {initials}
                  </span>
                </div>
              </div>
            </div>

            {/* Name + level badge */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <>
                  <Skel h={18} w={130} r={8} />
                  <div style={{ marginTop: 6 }}><Skel h={12} w={80} r={6} /></div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: 18, fontWeight: 700, color: C.t1,
                    letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {displayName}
                  </div>
                  {username && (
                    <div style={{ fontSize: 12, color: C.t3, marginBottom: 8 }}>{username}</div>
                  )}
                </>
              )}

              {/* Level badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: cfg.bg, border: `1px solid ${cfg.color}28`,
                borderRadius: 8, padding: '4px 10px',
              }}>
                <Crown size={10} color={cfg.color} strokeWidth={2.5} />
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: -0.2 }}>
                  {t(`level.${level}`)}
                </span>
              </div>
            </div>
          </div>

          {/* XP progress bar */}
          {!loading && cfg.next && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 10, color: C.t3, letterSpacing: 0.2 }}>XP</span>
                <span style={{ fontSize: 10, color: C.t3 }}>
                  {xp.toLocaleString('ru-RU')} / {cfg.next.toLocaleString('ru-RU')}
                </span>
              </div>
              <div style={{
                height: 3, borderRadius: 3,
                background: 'rgba(255,255,255,0.07)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  background: cfg.color,
                  width: `${pct * 100}%`,
                  transition: 'width 1s cubic-bezier(0.23,1,0.32,1) 0.3s',
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {/* Balance */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '16px 12px',
          animation: 'staggerIn 0.3s cubic-bezier(0.23,1,0.32,1) 0.05s both',
        }}>
          {loading
            ? <Skel h={24} w={60} r={7} />
            : <div style={{ fontSize: 22, fontWeight: 600, color: C.geo, letterSpacing: 0, lineHeight: 1, fontFamily: FF.display }}>
                {balance.toLocaleString('ru-RU')}
              </div>
          }
          <div style={{ fontSize: 10, fontWeight: 600, color: C.geo, opacity: 0.65, marginTop: 2, fontFamily: FF.display }}>GEO</div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 4, fontWeight: 500 }}>{t('hdr.balance')}</div>
        </div>

        {/* Visits */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '16px 12px',
          animation: 'staggerIn 0.3s cubic-bezier(0.23,1,0.32,1) 0.09s both',
        }}>
          {loading
            ? <Skel h={24} w={40} r={7} />
            : <div style={{ fontSize: 22, fontWeight: 600, color: C.teal, letterSpacing: 0, lineHeight: 1, fontFamily: FF.display }}>
                {visits}
              </div>
          }
          <div style={{ fontSize: 10, color: C.t3, marginTop: 6, fontWeight: 500 }}>{t('balance.visits')}</div>
        </div>

        {/* Streak */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '16px 12px',
          animation: 'staggerIn 0.3s cubic-bezier(0.23,1,0.32,1) 0.13s both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Flame size={13} color={streak > 0 ? C.orange : C.t3} strokeWidth={2} style={{ flexShrink: 0 }} />
            {loading
              ? <Skel h={24} w={30} r={7} />
              : <div style={{ fontSize: 22, fontWeight: 600, color: streak > 0 ? C.orange : C.t3, letterSpacing: 0, lineHeight: 1, fontFamily: FF.display }}>
                  {streak}
                </div>
            }
          </div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 4, fontWeight: 500 }}>{t('hdr.streak')}</div>
        </div>
      </div>

      {/* ── Language ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: '16px',
        marginBottom: 10,
        animation: 'staggerIn 0.3s cubic-bezier(0.23,1,0.32,1) 0.17s both',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 12 }}>
          {t('lang.title')}
        </div>
        <div style={{
          display: 'flex', gap: 4,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: 4,
        }}>
          {Object.entries(LANGS).map(([code, info]) => {
            const active = lang === code;
            return (
              <button key={code} onClick={() => setLang(code)} style={{
                flex: 1, borderRadius: 11, padding: '10px 0',
                border: 'none',
                background: active ? 'rgba(255,255,255,0.09)' : 'transparent',
                color: active ? C.t1 : C.t3,
                fontSize: 13, fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                transition: `background 0.18s ${EASE_OUT}, color 0.18s`,
                WebkitTapHighlightColor: 'transparent',
                letterSpacing: -0.2,
              }}>
                {info.short}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Super Admin ── */}
      {isSuperAdmin && (
        <PressableRow
          onClick={() => navigate('/superadmin')}
          style={{ marginBottom: 10 }}
        >
          <div style={{
            background: 'rgba(139,92,246,0.06)',
            border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 20, padding: '16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: 'rgba(139,92,246,0.15)',
              border: '1px solid rgba(139,92,246,0.30)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={17} color="#A78BFA" strokeWidth={1.75} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#A78BFA', letterSpacing: -0.2 }}>
                Super Admin
              </div>
              <div style={{ fontSize: 11, color: 'rgba(167,139,250,0.6)', marginTop: 2 }}>
                Панель управления
              </div>
            </div>
            <ChevronRight size={16} color="rgba(167,139,250,0.5)" strokeWidth={1.75} />
          </div>
        </PressableRow>
      )}

      {/* ── Become a partner ── */}
      {!isSuperAdmin && !isOwner && (
        <PressableRow
          onClick={() => navigate('/apply-business')}
          style={{ marginBottom: 10 }}
        >
          <div style={{
            background: C.geoDim,
            border: `1px solid ${C.geoGl}`,
            borderRadius: 20, padding: '16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: 'rgba(201,123,71,0.15)',
              border: `1px solid rgba(201,123,71,0.30)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Store size={17} color={C.geo} strokeWidth={1.75} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.geo, letterSpacing: -0.2 }}>
                Стать партнёром
              </div>
              <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                Подать заявку на бизнес-аккаунт
              </div>
            </div>
            <ChevronRight size={16} color={C.t3} strokeWidth={1.75} />
          </div>
        </PressableRow>
      )}

      {/* ── Support ── */}
      <PressableRow
        onClick={() => setSupportOpen(true)}
        style={{
          animation: 'staggerIn 0.3s cubic-bezier(0.23,1,0.32,1) 0.21s both',
        }}
      >
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: C.geoDim, border: `1px solid ${C.geoGl}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageCircle size={17} color={C.geo} strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, letterSpacing: -0.2 }}>
              {t('profile.support.open')}
            </div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
              {t('profile.support.title')}
            </div>
          </div>
          <ChevronRight size={16} color={C.t3} strokeWidth={1.75} />
        </div>
      </PressableRow>

      {supportOpen && <SupportSheet onClose={() => setSupportOpen(false)} />}
    </div>
  );
}
