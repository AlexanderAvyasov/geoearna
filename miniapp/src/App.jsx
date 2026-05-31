import { Component, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTelegram, tg, user } from './hooks/useTelegram';
import { MapPin, Activity, ScanLine, Wallet, User as UserIcon, Shield, Loader2, Home as HomeIcon, Star, Store as StoreIcon } from 'lucide-react';
import { C, E, FF } from './lib/design';
import { waitForInitData, API_BASE, apiFetch } from './lib/api';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { headerCache } from './lib/headerCache';
import Home       from './pages/Home';
import Map        from './pages/Map';
import Checkin    from './pages/Checkin';
import Balance    from './pages/Balance';
import Withdraw   from './pages/Withdraw';
import Admin      from './pages/Admin';
import SuperAdmin from './pages/SuperAdmin';
import Onboarding from './pages/Onboarding';
import Game       from './pages/Game';
import Legal      from './pages/Legal';
import ChannelSub from './pages/ChannelSub';
import Profile    from './pages/Profile';

const SA_TG_ID = Number(import.meta.env.VITE_SUPER_ADMIN_TG_ID) || 0;

// Module-level — computed once on load, reliable across all Telegram clients
const IS_TELEGRAM = Boolean(window.Telegram?.WebApp) || import.meta.env.DEV;

// ─── On-screen debug log (QR troubleshooting — dev only) ─────────────────────
const _dbuf = [];
const _dlisteners = new Set();
function _dpush(type, ...args) {
  const msg = args.map(a => {
    try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch { return String(a); }
  }).join(' ');
  _dbuf.unshift({ ts: Date.now(), type, msg: msg.slice(0, 300) });
  if (_dbuf.length > 60) _dbuf.length = 60;
  _dlisteners.forEach(fn => fn([..._dbuf]));
}
if (!import.meta.env.PROD) {
  const _clog = console.log.bind(console);
  const _cerr = console.error.bind(console);
  const _cwarn = console.warn.bind(console);
  console.log   = (...a) => { _clog(...a);   _dpush('log',   ...a); };
  console.error = (...a) => { _cerr(...a);   _dpush('error', ...a); };
  console.warn  = (...a) => { _cwarn(...a);  _dpush('warn',  ...a); };
}
const clog = import.meta.env.DEV ? console.log.bind(console)   : () => {};
const cerr = import.meta.env.DEV ? console.error.bind(console) : () => {};

function DebugOverlay() {
  if (import.meta.env.PROD) return null;
  const [logs,    setLogs]    = useState([..._dbuf]);
  const [open,    setOpen]    = useState(false);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    _dlisteners.add(setLogs);
    const tgw = window.Telegram?.WebApp;
    _dpush('log', `[TG] present:${!!tgw} ver:${tgw?.version||'?'} platform:${tgw?.platform||'?'}`);
    _dpush('log', `[TG] initData:${tgw?.initData ? 'ok('+tgw.initData.length+'ch)' : 'EMPTY'}`);
    _dpush('log', `[TG] showScanQrPopup:${typeof tgw?.showScanQrPopup}`);
    _dpush('log', `[TG] isVersionAtLeast_6.4:${tgw?.isVersionAtLeast?.('6.4')}`);
    _dpush('log', `[TG] closeScanQrPopup:${typeof tgw?.closeScanQrPopup}`);
    _dpush('log', `[NET] API_BASE:"${API_BASE}" | origin:${window.location.origin}`);
    return () => _dlisteners.delete(setLogs);
  }, []);

  function handleCopy() {
    const text = [...logs].reverse().map(e =>
      `${new Date(e.ts).toISOString().slice(11, 22)} [${e.type}] ${e.msg}`
    ).join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback for webviews without clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const colors = { log: '#d1fae5', warn: '#fbbf24', error: '#f87171' };
  const btnBase = { background: 'none', border: 'none', fontSize: 10, cursor: 'pointer', padding: '2px 6px', borderRadius: 5 };

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'fixed', bottom: 88, right: 12, zIndex: 9100,
          width: 34, height: 34, borderRadius: '50%',
          background: open ? 'rgba(239,68,68,0.85)' : 'rgba(201,123,71,0.85)',
          border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 900, color: '#090B10',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
        }}
      >
        {open ? '✕' : '🐛'}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 130, left: 8, right: 8, zIndex: 9099,
          background: 'rgba(5,8,14,0.97)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 14,
          maxHeight: '60vh', overflowY: 'auto',
          padding: '10px 12px',
          fontFamily: 'monospace', fontSize: 10.5,
          lineHeight: 1.5,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#C97B47', fontWeight: 700, fontSize: 11 }}>DEBUG · {logs.length} записей</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={handleCopy}
                style={{ ...btnBase, color: copied ? '#C97B47' : '#9ca3af', background: copied ? 'rgba(201,123,71,0.1)' : 'none' }}
              >
                {copied ? 'скопировано' : 'копировать все'}
              </button>
              <button
                onClick={() => { _dbuf.length = 0; setLogs([]); }}
                style={{ ...btnBase, color: '#6b7280' }}
              >очистить</button>
            </div>
          </div>
          {logs.length === 0 && <div style={{ color: '#4b5563' }}>Нет логов</div>}
          {logs.map((e, i) => (
            <div key={i} style={{ color: colors[e.type] || '#d1fae5', marginBottom: 2, wordBreak: 'break-all' }}>
              <span style={{ color: '#6b7280', marginRight: 5 }}>
                {new Date(e.ts).toISOString().slice(11, 22)}
              </span>
              {e.msg}
            </div>
          ))}
        </div>
      )}
    </>
  );
}


// ─── Error boundary — catches render-phase crashes ───────────────────────────
class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, stack: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    this.setState({ stack: info?.componentStack || '' });
    cerr('[ERROR_BOUNDARY] caught:', error?.message);
    cerr('[ERROR_BOUNDARY] stack:', info?.componentStack || '');
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#06080E', color: '#FF3860',
          padding: '32px 20px', fontFamily: 'monospace', fontSize: 13,
          overflowY: 'auto',
        }}>
          <div style={{ color: '#C97B47', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
            React render error
          </div>
          <div style={{ color: '#fbbf24', marginBottom: 12 }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <pre style={{ color: '#d1fae5', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null, stack: null })}
            style={{
              marginTop: 24, background: '#C97B47', color: '#06080E',
              border: 'none', padding: '12px 28px', borderRadius: 12,
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Browser gate (shown when not running inside Telegram Mini App) ───────────
function BrowserGate() {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 28px', textAlign: 'center',
    }}>
      {/* Logo */}
      <div style={{
        width: 96, height: 96, borderRadius: 28,
        background: 'linear-gradient(145deg, #0D1520 0%, #08101A 100%)',
        border: `0.5px solid rgba(201,123,71,0.30)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32,
        boxShadow: '0 0 40px rgba(201,123,71,0.10)',
      }}>
        <MapPin size={44} color={C.geo} strokeWidth={1.75} />
      </div>

      <div style={{ fontSize: 30, fontWeight: 700, color: C.t1, letterSpacing: 0, marginBottom: 6, fontFamily: FF.display }}>
        Geo<span style={{ color: C.geo }}>Earn</span>
      </div>

      <div style={{ fontSize: 15, color: C.t3, lineHeight: 1.7, marginBottom: 36, maxWidth: 280 }}>
        Это приложение работает только внутри <strong style={{ color: C.t2 }}>Telegram</strong>.<br />
        Открой бота и отсканируй QR-код прямо там.
      </div>

      <a
        href="https://t.me/geoearnbot"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: C.geo, color: C.bg,
          textDecoration: 'none',
          padding: '14px 36px', borderRadius: 14,
          fontWeight: 700, fontSize: 16,
          boxShadow: '0 6px 28px rgba(201,123,71,0.30)',
        }}
      >
        Открыть @geoearnbot
      </a>

      <div style={{ marginTop: 20, fontSize: 13, color: C.t3 }}>
        или найди <strong style={{ color: C.t2 }}>@geoearnbot</strong> в поиске Telegram
      </div>
    </div>
  );
}

export const GLOBAL_CSS = `
  @font-face {
    font-family: 'Ethnocentric';
    src: url('/fonts/ethnocentric.woff2') format('woff2'),
         url('/fonts/ethnocentric.woff') format('woff'),
         url('/fonts/ethnocentric.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

  :root {
    --geo: #C97B47;
    --bg: #081018;
    --surf: #101A24;
    --card: #16212D;
  }

  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root {
    margin: 0; padding: 0;
    background: ${C.bg};
    color: ${C.t1};
    font-family: 'Rajdhani', system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overscroll-behavior: none;
  }
  ::-webkit-scrollbar { display: none; }
  * { scrollbar-width: none; }

  /* ── Page enter — opacity+translate only; no scale (avoids compositing cost) ── */
  @keyframes pageEnter {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeDown {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-20px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  /* ── Ambient ── */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: .35; }
  }
  @keyframes glowPulse {
    0%, 100% { opacity: 0.40; }
    50%       { opacity: 0.78; }
  }
  @keyframes hudPulse {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1; }
  }
  @keyframes breatheGlow {
    0%, 100% { box-shadow: 0 0 10px rgba(201,123,71,0.18); }
    50%       { box-shadow: 0 0 28px rgba(201,123,71,0.45); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-5px); }
  }

  /* ── Map / radar ── */
  @keyframes radarPing {
    0%   { transform: scale(0.6); opacity: 0.8; }
    100% { transform: scale(2.4); opacity: 0; }
  }
  @keyframes userPing {
    0%, 100% { transform: scale(1);   opacity: .7; }
    50%       { transform: scale(1.7); opacity: 0; }
  }
  @keyframes markerPop {
    /* No overshoot — ease-out only via timing function */
    0%   { transform: translate(-50%,-100%) scale(0.5); opacity: 0; }
    60%  { transform: translate(-50%,-100%) scale(1.03); opacity: 1; }
    100% { transform: translate(-50%,-100%) scale(1);    opacity: 1; }
  }
  @keyframes markerPulse {
    0%, 100% { box-shadow: 0 0 0 0   rgba(201,123,71,0.55); }
    50%       { box-shadow: 0 0 0 8px rgba(201,123,71,0); }
  }

  /* ── Skeleton — gradient sweep ── */
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .sk {
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0.04) 0%,
      rgba(255,255,255,0.09) 30%,
      rgba(255,255,255,0.14) 50%,
      rgba(255,255,255,0.09) 70%,
      rgba(255,255,255,0.04) 100%
    );
    background-size: 200% 100%;
    flex-shrink: 0;
    animation: shimmer 1.7s ease-in-out infinite;
  }

  /* ── QR scan button ring ── */
  @keyframes scanRing {
    0%   { box-shadow: 0 0 0 0   rgba(201,123,71,.65); }
    65%  { box-shadow: 0 0 0 18px rgba(201,123,71,0); }
    100% { box-shadow: 0 0 0 0   rgba(201,123,71,0); }
  }

  /* ── Checkin success particles ── */
  @keyframes coinBurst {
    0%   { opacity: 1; transform: translate(0,0) scale(1); }
    100% { opacity: 0; transform: translate(var(--tx),var(--ty)) scale(0.15); }
  }

  /* ── Pop (icons, badges) — eased, no overshoot ── */
  @keyframes pop {
    0%   { transform: scale(0.55); opacity: 0; }
    65%  { transform: scale(1.03); opacity: 1; }
    100% { transform: scale(1);    opacity: 1; }
  }

  /* ── Ripple ── */
  @keyframes ripple {
    to { transform: scale(3); opacity: 0; }
  }
  @keyframes rippleOut {
    from { transform: scale(0); opacity: 0.28; }
    to   { transform: scale(3.5); opacity: 0; }
  }

  /* ── Content reveals ── */
  @keyframes fadeUp {
    from { transform: translateY(14px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes staggerIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  /* glowPulse defined once in Ambient section above */
  @keyframes morphIn {
    from { transform: translateY(10px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes cardReveal {
    from { transform: translateY(18px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  /* ── Modals ── */
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes backdropIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ── Toast ── */
  @keyframes toastIn {
    from { transform: translate(-50%, 16px); opacity: 0; }
    to   { transform: translate(-50%, 0);    opacity: 1; }
  }

  /* ── Spinner ── */
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* ── Slot machine digits ── */
  @keyframes slotDrop {
    from { transform: translateY(-85%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  /* ── Nav icon activate — press-then-settle, no overshoot ── */
  @keyframes iconBounce {
    0%   { transform: scale(1); }
    30%  { transform: scale(0.78); }
    70%  { transform: scale(1.04); }
    100% { transform: scale(1); }
  }

  /* ── Checkin success wave ── */
  @keyframes waveRise {
    0%   { transform: scaleY(0); opacity: 0; transform-origin: bottom; }
    35%  { opacity: 1; transform: scaleY(1); transform-origin: bottom; }
    100% { opacity: 0; transform: scaleY(1); transform-origin: bottom; }
  }
  @keyframes successGlow {
    0%, 100% { box-shadow: 0 0 0 0   rgba(143,174,123,.4); }
    50%       { box-shadow: 0 0 0 24px rgba(143,174,123,0); }
  }

  /* ── Streak milestone rays ── */
  @keyframes rayBurst {
    0%   { transform: scaleY(0); opacity: 0; }
    40%  { transform: scaleY(1); opacity: 1; }
    100% { transform: scaleY(1.45); opacity: 0; }
  }
  @keyframes streakPop {
    0%   { transform: scale(0.3); opacity: 0; }
    60%  { transform: scale(1.03); opacity: 1; }
    100% { transform: scale(1);   opacity: 1; }
  }

  /* ── Number / counter animation ── */
  @keyframes numberPop {
    0%   { transform: scale(0.65); opacity: 0; }
    65%  { transform: scale(1.03); opacity: 1; }
    100% { transform: scale(1);    opacity: 1; }
  }
  @keyframes counterRoll {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  /* ── Error shake ── */
  @keyframes shakeX {
    0%, 100% { transform: translateX(0); }
    15%       { transform: translateX(-7px); }
    30%       { transform: translateX(7px); }
    45%       { transform: translateX(-4px); }
    60%       { transform: translateX(4px); }
    75%       { transform: translateX(-2px); }
    90%       { transform: translateX(2px); }
  }

  /* ── Legacy splash aliases (kept for compat) ── */
  @keyframes splashLogoIn {
    0%   { opacity: 0; transform: scale(0.72) translateY(12px); }
    60%  { opacity: 1; transform: scale(1.04) translateY(-2px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes splashWordIn {
    0%   { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes splashFadeOut {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }

  /* ── Reduced motion — accessibility requirement ── */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
    .sk { animation: none !important; background: rgba(255,255,255,0.07) !important; }
  }
`;

// ─── Splash CSS (self-contained, does not depend on GLOBAL_CSS timing) ───────
const SPLASH_CSS = `
  /* ── 3D logo reveal: swings in from Y-axis ── */
  @keyframes _s3dReveal {
    0%   { opacity: 0; transform: perspective(560px) rotateY(-62deg) scale(0.82); }
    55%  { opacity: 1; transform: perspective(560px) rotateY(5deg) scale(1.03); }
    78%  { transform: perspective(560px) rotateY(-1.5deg) scale(0.99); }
    100% { opacity: 1; transform: perspective(560px) rotateY(0deg) scale(1); }
  }
  /* ── Continuous 3D micro-float — starts after reveal settles ── */
  @keyframes _s3dFloat {
    0%, 100% { transform: perspective(560px) rotateX(0deg) rotateY(0deg) translateY(0px); }
    28%       { transform: perspective(560px) rotateX(3.5deg) rotateY(5.5deg) translateY(-6px); }
    65%       { transform: perspective(560px) rotateX(-2deg) rotateY(-3.5deg) translateY(3px); }
  }
  /* ── Orbit ring spin — child of 3D container, tilts with it ── */
  @keyframes _sOrbitSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  /* ── Shadow stretches opposite to float ── */
  @keyframes _sShadowFloat {
    0%, 100% { transform: translateX(-50%) scaleX(1);    opacity: 0.38; }
    28%       { transform: translateX(-50%) scaleX(1.22); opacity: 0.20; }
    65%       { transform: translateX(-50%) scaleX(0.82); opacity: 0.52; }
  }
  /* ── Text / spinner fade-up ── */
  @keyframes _sTagIn {
    0%   { opacity: 0; transform: translateY(10px); filter: blur(4px); }
    100% { opacity: 1; transform: translateY(0);    filter: blur(0); }
  }
  /* ── Ambient background orbs ── */
  @keyframes _sOrb1 {
    0%, 100% { transform: translate(0,0) scale(1);    opacity: 0.6; }
    40%       { transform: translate(32px,-20px) scale(1.18); opacity: 1; }
    72%       { transform: translate(-18px,14px) scale(0.88); opacity: 0.45; }
  }
  @keyframes _sOrb2 {
    0%, 100% { transform: translate(0,0);         opacity: 0.5; }
    50%       { transform: translate(-24px,-18px); opacity: 0.85; }
  }
  /* ── Exit ── */
  @keyframes _sFadeOut {
    0%   { opacity: 1; transform: scale(1);    filter: blur(0); }
    100% { opacity: 0; transform: scale(1.03); filter: blur(4px); }
  }
`;

// ─── Splash / Loading screen ──────────────────────────────────────────────────

function SplashScreen({ fading }) {
  const { t } = useLanguage();
  const [imgErr, setImgErr] = useState(false);

  return (
    <>
      <style>{SPLASH_CSS}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: C.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        animation: fading ? '_sFadeOut 0.55s cubic-bezier(0.4,0,1,1) forwards' : 'none',
      }}>

        {/* Ambient orb 1 — amber */}
        <div style={{
          position: 'absolute', top: '14%', left: '12%',
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,123,71,0.16) 0%, transparent 65%)',
          filter: 'blur(36px)', pointerEvents: 'none',
          animation: '_sOrb1 8s ease-in-out infinite',
        }} />

        {/* Ambient orb 2 — cool accent */}
        <div style={{
          position: 'absolute', bottom: '18%', right: '8%',
          width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(70,110,180,0.12) 0%, transparent 70%)',
          filter: 'blur(30px)', pointerEvents: 'none',
          animation: '_sOrb2 10s ease-in-out 1.2s infinite',
        }} />

        {/* ── 3D logo assembly ── */}
        <div style={{
          position: 'relative',
          width: 148, height: 148,
          marginBottom: 36,
          animation: '_s3dReveal 0.82s cubic-bezier(0.22,1,0.36,1) both, _s3dFloat 5.5s ease-in-out 1s infinite',
          willChange: 'transform',
        }}>

          {/* Orbit ring — spins around the logo, tilts with 3D parent */}
          <div style={{
            position: 'absolute',
            top: -22, left: -22,
            width: 192, height: 192,
            borderRadius: '50%',
            border: '1px solid rgba(201,123,71,0.12)',
            borderTopColor: 'rgba(201,123,71,0.60)',
            borderRightColor: 'rgba(201,123,71,0.28)',
            animation: '_sOrbitSpin 3.6s linear infinite',
            pointerEvents: 'none',
          }} />

          {/* Inner orbit ring — opposite direction, slower */}
          <div style={{
            position: 'absolute',
            top: -10, left: -10,
            width: 168, height: 168,
            borderRadius: '50%',
            border: '1px solid rgba(201,123,71,0.06)',
            borderBottomColor: 'rgba(201,123,71,0.22)',
            animation: '_sOrbitSpin 6s linear reverse infinite',
            pointerEvents: 'none',
          }} />

          {/* Logo box */}
          <div style={{
            width: 148, height: 148,
            borderRadius: 38,
            background: 'linear-gradient(148deg, #0D1B2C 0%, #07101C 100%)',
            border: '0.5px solid rgba(201,123,71,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 28px 64px rgba(0,0,0,0.72), 0 1px 0 rgba(255,255,255,0.07) inset',
          }}>
            {imgErr
              ? <MapPin size={66} color={C.geo} strokeWidth={1.5} />
              : <img
                  src="/logo.png" alt=""
                  style={{ width: 136, height: 136, objectFit: 'contain', display: 'block' }}
                  onError={() => setImgErr(true)}
                />
            }
          </div>

          {/* Ground shadow — breathes opposite to float */}
          <div style={{
            position: 'absolute',
            bottom: -20, left: '50%',
            width: 80, height: 16,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(201,123,71,0.30) 0%, transparent 70%)',
            filter: 'blur(6px)',
            animation: '_sShadowFloat 5.5s ease-in-out 1s infinite',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Wordmark in Ethnocentric */}
        <div style={{
          fontSize: 30, fontWeight: 700, letterSpacing: 0,
          lineHeight: 1, fontFamily: FF.display,
          animation: '_sTagIn 0.5s cubic-bezier(0.22,1,0.36,1) 0.5s both',
        }}>
          <span style={{ color: C.t1 }}>Geo</span>
          <span style={{ color: C.geo }}>Earn</span>
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 12, color: C.t3, fontWeight: 500,
          marginTop: 7, letterSpacing: 0.2, textAlign: 'center', maxWidth: 200,
          animation: '_sTagIn 0.5s cubic-bezier(0.22,1,0.36,1) 0.68s both',
        }}>
          {t('splash.tagline')}
        </div>

        {/* Arc spinner */}
        <div style={{ marginTop: 50, animation: '_sTagIn 0.5s ease 0.72s both' }}>
          <svg width={36} height={36} viewBox="0 0 36 36"
            style={{ animation: '_sOrbitSpin 1.1s linear infinite' }}>
            <circle cx={18} cy={18} r={14} fill="none"
              stroke="rgba(201,123,71,0.10)" strokeWidth={1.75} />
            <circle cx={18} cy={18} r={14} fill="none"
              stroke={C.geo} strokeWidth={1.75}
              strokeLinecap="round" strokeDasharray="52 36" />
          </svg>
        </div>

      </div>
    </>
  );
}

function useAppReady() {
  const [phase, setPhase] = useState('loading'); // 'loading' | 'fading' | 'done'

  useEffect(() => {
    let cancelled = false;

    const minDelay = new Promise(r => setTimeout(r, 1400));
    const initReady = waitForInitData(8000);

    Promise.all([minDelay, initReady]).then(() => {
      if (cancelled) return;
      setPhase('fading');
      setTimeout(() => { if (!cancelled) setPhase('done'); }, 550);
    });

    return () => { cancelled = true; };
  }, []);

  return { ready: phase === 'done', fading: phase === 'fading' };
}

// ─────────────────────────────────────────────────────────────────────────────

function parseScanResult(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const t = url.searchParams.get('token');
    if (t) {
      return {
        token:   t,
        promo:   url.searchParams.get('promo')   === '1',
        geohunt: url.searchParams.get('geohunt') === '1',
      };
    }
  } catch { /* not a URL */ }
  if (/^[A-Za-z0-9_\-]{8,60}$/.test(raw.trim())) {
    return { token: raw.trim(), promo: false, geohunt: false };
  }
  return null;
}

// ScanQrButton owns NO navigation logic.
// It only scans, parses, and calls onQrResult(result).
// AppLayout owns navigate and scheduling.
function ScanQrButton({ onToast, onQrResult }) {
  const [scanning, setScanning] = useState(false);
  const scanRef = useRef(false);
  const { t } = useLanguage();

  function handleScan() {
    clog('[QR:SCAN_START] scanRef.current:', scanRef.current);
    if (scanRef.current) return;
    if (!tg?.isVersionAtLeast?.('6.4')) {
      clog('[QR:SCAN_START] TG version too old');
      onToast(t('scan.update_tg'));
      return;
    }
    if (typeof tg.showScanQrPopup !== 'function') {
      clog('[QR:SCAN_START] showScanQrPopup not available');
      onToast(t('scan.unavailable'));
      return;
    }

    scanRef.current = true;
    setScanning(true);
    clog('[QR:POPUP_OPEN] showScanQrPopup called');

    try {
      tg.showScanQrPopup({ text: t('scan.aim') }, (scannedText) => {
        clog('[QR:CALLBACK] raw:', scannedText?.slice(0, 80), '| length:', scannedText?.length);
        const result = parseScanResult(scannedText);
        clog('[QR:PARSE] result:', JSON.stringify(result));

        if (result) {
          clog('[QR:POPUP_CLOSE] calling closeScanQrPopup');
          tg.closeScanQrPopup();
          scanRef.current = false;
          setScanning(false);
          clog('[QR:PASS_TO_APP] calling onQrResult with token:', result.token);
          onQrResult(result);
          return true;
        }
        clog('[QR:UNRECOGNIZED] no result — keeping popup open');
        return false;
      });
    } catch (e) {
      cerr('[QR:POPUP_ERROR]', e.message);
      scanRef.current = false;
      setScanning(false);
    }

    setTimeout(() => {
      if (scanRef.current) {
        clog('[QR:TIMEOUT] 30s timeout — resetting scan state');
        scanRef.current = false;
        setScanning(false);
      }
    }, 30000);
  }

  return (
    /* Outer glow ring — decoupled from button transform so press state is clean */
    <div style={{ position: 'relative', bottom: 14, flexShrink: 0 }}>
      {!scanning && (
        <div style={{
          position: 'absolute', inset: -2,
          borderRadius: '50%',
          background: C.geo,
          opacity: 0.35,
          filter: 'blur(8px)',
          animation: 'glowPulse 3s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}
      <button
        onClick={handleScan}
        style={{
          position: 'relative',
          width: 50, height: 50,
          borderRadius: '50%',
          background: scanning
            ? 'rgba(143,174,123,0.5)'
            : 'linear-gradient(145deg,#D48A52 0%,#C97B47 100%)',
          border: `2px solid ${C.bg}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: scanning ? 'not-allowed' : 'pointer',
          flexShrink: 0,
          WebkitTapHighlightColor: 'transparent',
          outline: 'none', zIndex: 10,
          transition: 'transform 100ms cubic-bezier(0.23,1,0.32,1)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        }}
        onTouchStart={e => { if (!scanning) e.currentTarget.style.transform = 'scale(0.92)'; }}
        onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        onMouseDown={e => { if (!scanning) e.currentTarget.style.transform = 'scale(0.92)'; }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {scanning
          ? <Loader2 size={20} strokeWidth={2.25} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
          : <ScanLine size={20} strokeWidth={2.25} color="#0A0E14" />
        }
      </button>
    </div>
  );
}

function Toast({ message }) {
  return (
    <div style={{
      position: 'fixed', bottom: 100, left: '50%',
      transform: 'translate(-50%, 0)',
      background: C.card,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      color: C.t1, borderRadius: 14,
      padding: '12px 22px', fontSize: 14, fontWeight: 600,
      zIndex: 500, whiteSpace: 'nowrap',
      animation: 'toastIn 0.25s ease',
      maxWidth: 'calc(100vw - 48px)', textAlign: 'center',
      border: `0.5px solid rgba(255,255,255,0.10)`,
    }}>
      {message}
    </div>
  );
}

function BottomNav({ onQrResult, isOwner, isSuperAdmin }) {
  const { pathname } = useLocation();
  const [toast, setToast] = useState(null);
  const { t } = useLanguage();
  const navRef = useRef(null);
  const [indicatorX, setIndicatorX] = useState(null);

  const IS_SUPER_ADMIN = isSuperAdmin;

  const NAV_ITEMS = [
    { to: '/',        Icon: MapPin,    label: t('nav.home')     },
    { to: '/game',    Icon: Activity,  label: t('nav.game')     },
    null,
    { to: '/balance', Icon: Wallet,    label: t('nav.balance')  },
    IS_SUPER_ADMIN
      ? { to: '/superadmin', Icon: Shield,    label: 'SA'                  }
      : isOwner
        ? { to: '/admin',    Icon: StoreIcon, label: t('nav.business')     }
        : { to: '/profile',  Icon: UserIcon,  label: t('nav.profile')      },
  ];

  // Computed before hooks — used by useLayoutEffect below
  const shouldHide =
    pathname === '/checkin' || pathname === '/withdraw' ||
    pathname === '/legal'   || pathname === '/channel-reward' ||
    (IS_SUPER_ADMIN && pathname === '/admin');

  const activeIdx = shouldHide ? -1 : NAV_ITEMS.findIndex(item =>
    item && (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to))
  );

  // MUST stay before any early return — React requires hooks in identical order every render
  useLayoutEffect(() => {
    if (!navRef.current || activeIdx < 0) return;
    const tab = navRef.current.querySelector(`[data-tab="${activeIdx}"]`);
    if (!tab) return;
    const navRect = navRef.current.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    setIndicatorX(tabRect.left - navRect.left + tabRect.width / 2 - 12);
  }, [pathname]);

  // Early return only after all hooks have been called
  if (shouldHide) return null;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <>
      <nav ref={navRef} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(8,16,24,0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'flex-end',
        paddingBottom: 'env(safe-area-inset-bottom, 6px)',
        zIndex: 100,
        height: 58,
      }}>
        {/* Sliding line indicator — transform only, GPU safe */}
        <div style={{
          position: 'absolute', top: 0,
          left: 0, width: 24, height: 2,
          borderRadius: 1,
          background: C.geo,
          transform: `translateX(${indicatorX ?? 0}px)`,
          opacity: indicatorX !== null ? 1 : 0,
          transition: 'transform 0.30s cubic-bezier(0.32,0.72,0,1), opacity 0.18s',
          pointerEvents: 'none',
        }} />

        {NAV_ITEMS.map((item, idx) => {
          if (!item) {
            return (
              <div key="scan" style={{
                flex: 1.1, display: 'flex', justifyContent: 'center',
                alignItems: 'flex-end', paddingBottom: 4,
              }}>
                <ScanQrButton onToast={showToast} onQrResult={onQrResult} />
              </div>
            );
          }

          const isActive = item.to === '/'
            ? pathname === '/'
            : pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-tab={idx}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3, padding: '10px 0 8px',
                textDecoration: 'none', position: 'relative',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <item.Icon
                key={isActive ? `${item.to}-on` : `${item.to}-off`}
                size={20}
                strokeWidth={isActive ? 2.25 : 1.5}
                color={isActive ? C.geo : C.t3}
                style={{
                  display: 'block',
                  animation: isActive ? 'iconBounce 0.22s ease both' : 'none',
                  transition: 'color 0.18s cubic-bezier(0.23,1,0.32,1)',
                }}
              />
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 500,
                letterSpacing: 0,
                color: isActive ? C.geo : C.t3,
                transition: 'color 0.18s cubic-bezier(0.23,1,0.32,1)',
              }}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
      {toast && <Toast message={toast} />}
    </>
  );
}

function GlobalHeader({ showStats = true }) {
  const [stats, setStats] = useState(headerCache.get());
  const { t } = useLanguage();

  useEffect(() => {
    if (headerCache.get()) return;
    Promise.all([
      apiFetch('/api/me').then(r => r.ok ? r.json() : null).catch(() => null),
      apiFetch('/api/me/game').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([me, game]) => {
      const s = {
        balance:    me?.user?.balance ?? 0,
        level:      game?.level ?? 1,
        streak:     game?.streak?.current_streak ?? 0,
        tasksDone:  (game?.tasks || []).filter(t => t.claimed).length,
        tasksTotal: (game?.tasks || []).length,
      };
      headerCache.set(s);
      setStats(s);
    });
  }, []);

  return (
    <div style={{
      background: 'rgba(8,16,24,0.98)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      padding: '0 16px',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      {/* Brand row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 36, borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: C.green,
            boxShadow: `0 0 6px ${C.green}`,
            animation: 'hudPulse 2.5s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, letterSpacing: 0.3 }}>GeoEarn</span>
          {stats && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: C.t3,
              background: C.geoDim, border: `1px solid ${C.geoGl}`,
              borderRadius: 6, padding: '1px 7px',
            }}>L{stats.level}</span>
          )}
        </div>
        {stats ? (
          <span style={{ fontSize: 10, color: C.gold, fontWeight: 600 }}>
            {t('hdr.tasks_done', { n: stats.tasksDone })}
          </span>
        ) : (
          <div className="sk" style={{ height: 12, width: 60, borderRadius: 6 }} />
        )}
      </div>

      {/* Stats row — only on Home */}
      {showStats && <div style={{ display: 'flex', height: 30, alignItems: 'center' }}>
        {stats ? [
          { label: t('hdr.balance'), val: `${stats.balance.toLocaleString('ru-RU')} GEO` },
          { label: t('hdr.streak'),  val: `${stats.streak}д` },
          { label: t('hdr.tasks'),   val: `${stats.tasksDone}/${stats.tasksTotal}` },
        ].map((item, i) => (
          <div key={i} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            paddingLeft: i === 0 ? 0 : 10,
            borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <span style={{ fontSize: 9, color: C.t3, letterSpacing: 0.3, marginBottom: 1 }}>{item.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: i === 0 ? C.geo : C.t1 }}>{item.val}</span>
          </div>
        )) : (
          <div style={{ display: 'flex', gap: 8 }}>
            {[70, 45, 50].map((w, i) => <div key={i} className="sk" style={{ height: 14, width: w, borderRadius: 6 }} />)}
          </div>
        )}
      </div>}
    </div>
  );
}

function AppLayout() {
  const location   = useLocation();
  const navigate   = useNavigate();
  const { pathname } = location;
  const [isOwner,      setIsOwner]      = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Keep navigate in a ref — stable across re-renders, safe to call from setTimeout
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    apiFetch('/api/admin/business')
      .then(r => setIsOwner(r.status === 200))
      .catch(() => setIsOwner(false));
    apiFetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => setIsSuperAdmin(d?.is_super_admin || false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    clog('[ROUTER:CHANGE] pathname:', pathname, '| search:', location.search, '| hash:', window.location.hash);
  }, [location]);

  function handleQrResult(result) {
    clog('[QR:RECEIVED_BY_LAYOUT] token:', result.token, 'promo:', result.promo, 'geohunt:', result.geohunt);
    const qs = new URLSearchParams({ token: result.token });
    if (result.promo)   qs.set('promo',   '1');
    if (result.geohunt) qs.set('geohunt', '1');
    const target = `/checkin?${qs.toString()}`;
    clog('[QR:NAVIGATE_SCHEDULED] target:', target, '| in 400ms');
    setTimeout(() => {
      clog('[QR:NAVIGATE_EXEC] navigate() calling with:', target, '| current pathname:', window.location.pathname);
      navigateRef.current(target);
    }, 400);
  }

  const hasNav   = pathname !== '/checkin' && pathname !== '/withdraw' && pathname !== '/legal' && pathname !== '/channel-reward';
  const isSAPage = pathname === '/superadmin';

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: "'Inter', 'Space Grotesk', -apple-system, sans-serif",
      color: C.t1,
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        maxWidth: 480, margin: '0 auto',
        paddingBottom: hasNav ? 68 : 0,
        height: isSAPage ? 'auto' : undefined,
      }}>
        <Routes>
          <Route path="/"                element={<Home />} />
          <Route path="/map"             element={<Map />} />
          <Route path="/checkin"         element={<Checkin />} />
          <Route path="/balance"         element={<Balance />} />
          <Route path="/withdraw"        element={<Withdraw />} />
          <Route path="/game"            element={<Game />} />
          <Route path="/admin"           element={<Admin />} />
          <Route path="/superadmin"      element={<SuperAdmin />} />
          <Route path="/legal"           element={<Legal />} />
          <Route path="/channel-reward"  element={<ChannelSub />} />
          <Route path="/profile"         element={<Profile />} />
        </Routes>
      </div>
      <BottomNav onQrResult={handleQrResult} isOwner={isOwner} isSuperAdmin={isSuperAdmin} />
    </div>
  );
}

export default function App() {
  useTelegram();
  const { ready, fading } = useAppReady();
  const ONBOARD_KEY = user?.id ? `geo_onboarded_${user.id}` : 'geo_onboarded';
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem(ONBOARD_KEY));

  function handleOnboardDone(mode) {
    localStorage.setItem(ONBOARD_KEY, '1');
    if (mode) localStorage.setItem('geo_mode', mode);
    setOnboarded(true);
  }

  if (!IS_TELEGRAM) {
    return (
      <LanguageProvider>
        <style>{GLOBAL_CSS}</style>
        <BrowserGate />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <style>{GLOBAL_CSS}</style>

      {/* Splash screen: shown until ready, fades out when fading=true */}
      {!ready && <SplashScreen fading={fading} />}

      {/* App: render immediately in background so routes & data load during splash */}
      <AppErrorBoundary>
        {!onboarded ? (
          <Onboarding onDone={handleOnboardDone} />
        ) : (
          <BrowserRouter>
            <AppLayout />
          </BrowserRouter>
        )}
      </AppErrorBoundary>

      {/* Debug overlay — tap 🐛 button (bottom-right) to view logs */}
      <DebugOverlay />

    </LanguageProvider>
  );
}
