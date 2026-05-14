import { useEffect, useRef, useState } from 'react';
import { Crown, Flame, MessageCircle, AlertCircle, Send, CheckCircle, X, Loader2 } from 'lucide-react';
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
    setErr('');
    setSubmitting(true);
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
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          zIndex: 200, animation: 'backdropIn 0.22s ease',
        }}
      />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.surf || C.card,
        borderRadius: '22px 22px 0 0',
        border: `1px solid ${C.b2}`, borderBottom: 'none',
        padding: '0 0 36px', zIndex: 201,
        maxWidth: 480, margin: '0 auto',
        animation: 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.b2, margin: '14px auto 18px' }} />
        <div style={{ padding: '0 20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{t('support.title')}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.t3, padding: 4 }}>
              <X size={18} color={C.t3} />
            </button>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.geoDim, border: `1px solid ${C.geoGl}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle size={32} color={C.geo} strokeWidth={2} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, marginBottom: 8 }}>{t('support.sent')}</div>
              <div style={{ fontSize: 13, color: C.t3, marginBottom: 20, lineHeight: 1.5 }}>{t('support.sent_sub')}</div>
              <button onClick={onClose} style={{ background: C.geo, color: C.bg, border: 'none', borderRadius: 12, padding: '12px 32px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {t('support.close')}
              </button>
            </div>
          ) : (
            <>
              {/* Type toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { key: 'chat',   label: t('support.type.chat'),   Icon: MessageCircle },
                  { key: 'report', label: t('support.type.report'), Icon: AlertCircle   },
                ].map(({ key, label, Icon }) => {
                  const active = type === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setType(key)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '10px 0', borderRadius: 10,
                        border: `1px solid ${active ? C.geo : C.b2}`,
                        background: active ? C.geoDim : 'transparent',
                        color: active ? C.geo : C.t3,
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        cursor: 'pointer', transition: `all 0.15s ${E.smooth}`,
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <Icon size={14} strokeWidth={2} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={t('support.placeholder')}
                rows={4}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 14px', borderRadius: 12,
                  border: `1.5px solid ${err ? C.red : C.b2}`,
                  background: C.card || 'rgba(255,255,255,0.04)',
                  color: C.t1, fontSize: 14, outline: 'none',
                  resize: 'none', lineHeight: 1.5,
                  transition: 'border 0.15s',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ fontSize: 11, color: C.t3, textAlign: 'right', marginTop: 3, marginBottom: 4 }}>
                {message.length}/2000
              </div>

              {err && (
                <div style={{ fontSize: 13, color: C.red, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} color={C.red} /> {err}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSend}
                disabled={submitting || message.trim().length < 3}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: (submitting || message.trim().length < 3) ? C.cardHi : C.geo,
                  color: (submitting || message.trim().length < 3) ? C.t3 : C.bg,
                  fontSize: 15, fontWeight: 700,
                  cursor: (submitting || message.trim().length < 3) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: `all 0.15s ${E.smooth}`,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {submitting
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {t('support.sending')}</>
                  : <><Send size={16} strokeWidth={2} /> {t('support.send')}</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Profile() {
  const { t, lang, setLang } = useLanguage();
  const [meData,   setMeData]   = useState(null);
  const [gameData, setGameData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [supportOpen, setSupportOpen] = useState(false);

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
      <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '16px', marginBottom: 14 }}>
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

      {/* ── Support ── */}
      <div style={{ ...cardBase, border: `1px solid ${C.b1}`, padding: '16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
          {t('profile.support.title')}
        </div>
        <button
          onClick={() => setSupportOpen(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            background: C.geoDim, border: `1px solid ${C.geoGl}`,
            borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            transition: `all 0.15s ${E.smooth}`,
          }}
        >
          <MessageCircle size={16} color={C.geo} strokeWidth={2} />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.geo }}>{t('profile.support.open')}</span>
        </button>
      </div>

      {supportOpen && <SupportSheet onClose={() => setSupportOpen(false)} />}
    </div>
  );
}
