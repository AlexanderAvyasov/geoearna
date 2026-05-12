import { Component, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTelegram, tg, user } from './hooks/useTelegram';
import { Home as HomeIcon, Star, ScanLine, Wallet, Store as StoreIcon, Shield, Loader2, MapPin } from 'lucide-react';
import { C, E } from './lib/design';
import { waitForInitData, API_BASE } from './lib/api';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import Home       from './pages/Home';
import Checkin    from './pages/Checkin';
import Balance    from './pages/Balance';
import Withdraw   from './pages/Withdraw';
import Admin      from './pages/Admin';
import SuperAdmin from './pages/SuperAdmin';
import Onboarding from './pages/Onboarding';
import Game       from './pages/Game';
import Legal      from './pages/Legal';
import ChannelSub from './pages/ChannelSub';

const IS_SUPER_ADMIN = user?.id === 930826522;

// Module-level — computed once on load, reliable across all Telegram clients
const IS_TELEGRAM = Boolean(window.Telegram?.WebApp) || import.meta.env.DEV;

// ─── On-screen debug log (QR troubleshooting) ────────────────────────────────
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
const _clog = console.log.bind(console);
const _cerr = console.error.bind(console);
const _cwarn = console.warn.bind(console);
console.log   = (...a) => { _clog(...a);   _dpush('log',   ...a); };
console.error = (...a) => { _cerr(...a);   _dpush('error', ...a); };
console.warn  = (...a) => { _cwarn(...a);  _dpush('warn',  ...a); };

function DebugOverlay() {
  const [logs,    setLogs]    = useState([..._dbuf]);
  const [open,    setOpen]    = useState(false);

  useEffect(() => {
    _dlisteners.add(setLogs);
    // Log Telegram environment on first render
    const tgw = window.Telegram?.WebApp;
    _dpush('log', `[TG] present:${!!tgw} ver:${tgw?.version||'?'} platform:${tgw?.platform||'?'}`);
    _dpush('log', `[TG] initData:${tgw?.initData ? 'ok('+tgw.initData.length+'ch)' : 'EMPTY'}`);
    _dpush('log', `[TG] showScanQrPopup:${typeof tgw?.showScanQrPopup}`);
    _dpush('log', `[TG] isVersionAtLeast_6.4:${tgw?.isVersionAtLeast?.('6.4')}`);
    _dpush('log', `[TG] closeScanQrPopup:${typeof tgw?.closeScanQrPopup}`);
    _dpush('log', `[NET] API_BASE:"${API_BASE}" | origin:${window.location.origin}`);
    return () => _dlisteners.delete(setLogs);
  }, []);

  const colors = { log: '#d1fae5', warn: '#fbbf24', error: '#f87171' };

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'fixed', bottom: 88, right: 12, zIndex: 9100,
          width: 34, height: 34, borderRadius: '50%',
          background: open ? 'rgba(239,68,68,0.85)' : 'rgba(198,241,53,0.85)',
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
          border: '1px solid rgba(198,241,53,0.25)',
          borderRadius: 14,
          maxHeight: '60vh', overflowY: 'auto',
          padding: '10px 12px',
          fontFamily: 'monospace', fontSize: 10.5,
          lineHeight: 1.5,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#C6F135', fontWeight: 700, fontSize: 11 }}>DEBUG · {logs.length} записей</span>
            <button
              onClick={() => { _dbuf.length = 0; setLogs([]); }}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 10, cursor: 'pointer' }}
            >очистить</button>
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
    console.error('[ERROR_BOUNDARY] caught:', error?.message);
    console.error('[ERROR_BOUNDARY] stack:', info?.componentStack || '');
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#090B10', color: '#f87171',
          padding: '32px 20px', fontFamily: 'monospace', fontSize: 13,
          overflowY: 'auto',
        }}>
          <div style={{ color: '#C6F135', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
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
              marginTop: 24, background: '#C6F135', color: '#090B10',
              border: 'none', padding: '12px 28px', borderRadius: 10,
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
        background: 'linear-gradient(145deg, #1A2010 0%, #111708 100%)',
        border: '1.5px solid rgba(198,241,53,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 32,
        boxShadow: '0 0 40px rgba(198,241,53,0.12)',
      }}>
        <MapPin size={44} color={C.geo} strokeWidth={1.75} />
      </div>

      <div style={{ fontSize: 30, fontWeight: 800, color: C.t1, letterSpacing: -0.8, marginBottom: 6 }}>
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
          padding: '16px 36px', borderRadius: 16,
          fontWeight: 800, fontSize: 17, letterSpacing: 0.2,
          boxShadow: '0 6px 28px rgba(198,241,53,0.30)',
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
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root {
    margin: 0; padding: 0;
    background: ${C.bg};
    color: ${C.t1};
    font-family: 'Barlow Condensed', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overscroll-behavior: none;
  }
  ::-webkit-scrollbar { display: none; }
  * { scrollbar-width: none; }

  @keyframes pageEnter {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: .35; }
  }
  @keyframes glowPulse {
    0%, 100% { opacity: .4; transform: scale(1); }
    50%       { opacity: .8; transform: scale(1.05); }
  }
  @keyframes scanRing {
    0%   { box-shadow: 0 0 0 0   rgba(198,241,53,.6); }
    60%  { box-shadow: 0 0 0 14px rgba(198,241,53,0); }
    100% { box-shadow: 0 0 0 0   rgba(198,241,53,0); }
  }
  @keyframes coinBurst {
    0%   { opacity: 1; transform: translate(0,0) scale(1); }
    100% { opacity: 0; transform: translate(var(--tx),var(--ty)) scale(0.2); }
  }
  @keyframes pop {
    0%   { transform: scale(0.6); opacity: 0; }
    70%  { transform: scale(1.08); }
    100% { transform: scale(1);   opacity: 1; }
  }
  @keyframes ripple {
    to { transform: scale(3); opacity: 0; }
  }
  @keyframes rippleOut {
    from { transform: scale(0); opacity: 0.28; }
    to   { transform: scale(3.5); opacity: 0; }
  }
  @keyframes fadeUp {
    from { transform: translateY(14px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes backdropIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes userPing {
    0%, 100% { transform: scale(1);   opacity: .7; }
    50%       { transform: scale(1.7); opacity: 0; }
  }
  @keyframes successGlow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(198,241,53,.4); }
    50%       { box-shadow: 0 0 0 22px rgba(198,241,53,0); }
  }
  @keyframes toastIn {
    from { transform: translate(-50%, 10px); opacity: 0; }
    to   { transform: translate(-50%, 0);    opacity: 1; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-5px); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* ── Slot machine digits ── */
  @keyframes slotDrop {
    0%   { transform: translateY(-90%); opacity: 0; }
    60%  { transform: translateY(5%);   opacity: 1; }
    100% { transform: translateY(0);    opacity: 1; }
  }

  /* ── Nav icon bounce on activation ── */
  @keyframes iconBounce {
    0%   { transform: scale(1); }
    28%  { transform: scale(0.8); }
    68%  { transform: scale(1.14); }
    100% { transform: scale(1); }
  }

  /* ── Checkin success wave ── */
  @keyframes waveRise {
    0%   { transform: scaleY(0); opacity: 0; transform-origin: bottom; }
    35%  { opacity: 1; transform: scaleY(1); transform-origin: bottom; }
    100% { opacity: 0; transform: scaleY(1); transform-origin: bottom; }
  }

  /* ── Streak milestone rays ── */
  @keyframes rayBurst {
    0%   { transform: scaleY(0); opacity: 0; }
    40%  { transform: scaleY(1); opacity: 1; }
    100% { transform: scaleY(1.4); opacity: 0; }
  }
  @keyframes streakPop {
    0%   { transform: scale(0.3); opacity: 0; }
    55%  { transform: scale(1.1); opacity: 1; }
    80%  { transform: scale(0.95); }
    100% { transform: scale(1);   opacity: 1; }
  }

  /* ── Map marker entrance ── */
  @keyframes markerPop {
    0%   { transform: translate(-50%,-100%) scale(0); opacity: 0; }
    65%  { transform: translate(-50%,-100%) scale(1.18); opacity: 1; }
    100% { transform: translate(-50%,-100%) scale(1); opacity: 1; }
  }
  @keyframes markerPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(198,241,53,0.55); }
    50%       { box-shadow: 0 0 0 8px rgba(198,241,53,0); }
  }

  /* ── Skeleton — static dark block only, no sweep ── */
  .sk {
    background: rgba(255,255,255,0.055);
    flex-shrink: 0;
  }

  @keyframes splashLogoIn {
    0%   { opacity: 0; transform: scale(0.72) translateY(12px); }
    60%  { opacity: 1; transform: scale(1.04) translateY(-2px); }
    100% { opacity: 1; transform: scale(1)    translateY(0); }
  }
  @keyframes splashWordIn {
    0%   { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes splashDot {
    0%, 80%, 100% { transform: scale(0.55); opacity: 0.25; }
    40%            { transform: scale(1);    opacity: 1; }
  }
  @keyframes splashRing {
    0%   { box-shadow: 0 0 0 0   rgba(198,241,53,0.45); }
    70%  { box-shadow: 0 0 0 22px rgba(198,241,53,0); }
    100% { box-shadow: 0 0 0 0   rgba(198,241,53,0); }
  }
  @keyframes splashFadeOut {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }
`;

// ─── Splash CSS (self-contained, does not depend on GLOBAL_CSS timing) ───────
const SPLASH_CSS = `
  @keyframes _sLogoIn {
    0%   { opacity: 0; transform: scale(0.72) translateY(12px); }
    60%  { opacity: 1; transform: scale(1.04) translateY(-2px); }
    100% { opacity: 1; transform: scale(1)    translateY(0); }
  }
  @keyframes _sWordIn {
    0%   { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes _sDot {
    0%, 80%, 100% { transform: scale(0.55); opacity: 0.25; }
    40%            { transform: scale(1);    opacity: 1; }
  }
  @keyframes _sRing {
    0%   { box-shadow: 0 0 0 0    rgba(198,241,53,0.45); }
    70%  { box-shadow: 0 0 0 22px rgba(198,241,53,0); }
    100% { box-shadow: 0 0 0 0    rgba(198,241,53,0); }
  }
  @keyframes _sFadeOut {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }
`;

// ─── Splash / Loading screen ──────────────────────────────────────────────────

function SplashScreen({ fading }) {
  const { t } = useLanguage();
  return (
    <>
      <style>{SPLASH_CSS}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: C.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: fading ? '_sFadeOut 0.45s ease forwards' : 'none',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: '28%', left: '50%',
          transform: 'translateX(-50%)',
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(198,241,53,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo mark */}
        <div style={{
          position: 'relative',
          width: 88, height: 88,
          borderRadius: 28,
          background: 'linear-gradient(145deg, #1A2010 0%, #111708 100%)',
          border: '1.5px solid rgba(198,241,53,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: '_sLogoIn 0.65s cubic-bezier(0.32,0.72,0,1) both, _sRing 2.4s ease-in-out 0.7s infinite',
          marginBottom: 24,
        }}>
          <MapPin size={40} color={C.geo} strokeWidth={1.75} />
          <div style={{
            position: 'absolute', top: 10, right: 10,
            width: 9, height: 9, borderRadius: '50%',
            background: C.geo,
            boxShadow: `0 0 8px ${C.geo}`,
          }} />
        </div>

        {/* Wordmark */}
        <div style={{
          animation: '_sWordIn 0.5s ease 0.3s both',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 28, fontWeight: 800, letterSpacing: -0.8,
            color: C.t1, lineHeight: 1,
          }}>
            Geo<span style={{ color: C.geo }}>Earn</span>
          </div>
          <div style={{
            fontSize: 13, color: C.t3, fontWeight: 500,
            marginTop: 6, letterSpacing: 0.3,
          }}>
            {t('splash.tagline')}
          </div>
        </div>

        {/* Loading dots */}
        <div style={{
          display: 'flex', gap: 7, marginTop: 48,
          animation: '_sWordIn 0.5s ease 0.5s both',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: C.geo,
              animation: `_sDot 1.3s ease-in-out ${i * 0.18}s infinite`,
            }} />
          ))}
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
      setTimeout(() => { if (!cancelled) setPhase('done'); }, 450);
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
    console.log('[QR:SCAN_START] scanRef.current:', scanRef.current);
    if (scanRef.current) return;
    if (!tg?.isVersionAtLeast?.('6.4')) {
      console.log('[QR:SCAN_START] TG version too old');
      onToast(t('scan.update_tg'));
      return;
    }
    if (typeof tg.showScanQrPopup !== 'function') {
      console.log('[QR:SCAN_START] showScanQrPopup not available');
      onToast(t('scan.unavailable'));
      return;
    }

    scanRef.current = true;
    setScanning(true);
    console.log('[QR:POPUP_OPEN] showScanQrPopup called');

    try {
      tg.showScanQrPopup({ text: t('scan.aim') }, (scannedText) => {
        console.log('[QR:CALLBACK] raw:', scannedText?.slice(0, 80), '| length:', scannedText?.length);
        const result = parseScanResult(scannedText);
        console.log('[QR:PARSE] result:', JSON.stringify(result));

        if (result) {
          console.log('[QR:POPUP_CLOSE] calling closeScanQrPopup');
          tg.closeScanQrPopup();
          scanRef.current = false;
          setScanning(false);
          console.log('[QR:PASS_TO_APP] calling onQrResult with token:', result.token);
          onQrResult(result);
          return true;
        }
        console.log('[QR:UNRECOGNIZED] no result — keeping popup open');
        return false;
      });
    } catch (e) {
      console.error('[QR:POPUP_ERROR]', e.message);
      scanRef.current = false;
      setScanning(false);
    }

    setTimeout(() => {
      if (scanRef.current) {
        console.log('[QR:TIMEOUT] 30s timeout — resetting scan state');
        scanRef.current = false;
        setScanning(false);
      }
    }, 30000);
  }

  return (
    <button
      onClick={handleScan}
      style={{
        position: 'relative',
        bottom: 18,
        width: 54,
        height: 54,
        borderRadius: '50%',
        background: scanning ? 'rgba(140,180,20,0.6)' : C.geo,
        border: `2px solid ${C.bg}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: scanning ? 'not-allowed' : 'pointer',
        animation: scanning ? 'none' : 'scanRing 2.4s ease-in-out infinite',
        flexShrink: 0,
        transition: `all 0.15s ${E.spring}`,
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        zIndex: 10,
      }}
      onTouchStart={e => { if (!scanning) e.currentTarget.style.transform = 'scale(0.88)'; }}
      onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseDown={e => { if (!scanning) e.currentTarget.style.transform = 'scale(0.88)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {scanning
        ? <Loader2 size={22} strokeWidth={2} color={C.bg} style={{ animation: 'spin 1s linear infinite' }} />
        : <ScanLine size={22} strokeWidth={2} color={C.bg} />
      }
    </button>
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

function BottomNav({ onQrResult }) {
  const { pathname } = useLocation();
  const [toast, setToast] = useState(null);
  const { t } = useLanguage();
  const navRef = useRef(null);
  const [indicatorX, setIndicatorX] = useState(null);

  const NAV_ITEMS = [
    { to: '/',        Icon: HomeIcon,  label: t('nav.home')     },
    { to: '/game',    Icon: Star,      label: t('nav.game')     },
    null,
    { to: '/balance', Icon: Wallet,    label: t('nav.balance')  },
    IS_SUPER_ADMIN
      ? { to: '/superadmin', Icon: Shield,    label: 'SA'                }
      : { to: '/admin',      Icon: StoreIcon, label: t('nav.business')   },
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
        background: 'rgba(9,11,16,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '0.5px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'flex-end',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        zIndex: 100,
        height: 72,
      }}>
        {/* Sliding indicator */}
        {indicatorX !== null && (
          <div style={{
            position: 'absolute', top: 0,
            left: indicatorX,
            width: 24, height: 2.5, borderRadius: 2,
            background: C.geo,
            boxShadow: `0 0 8px ${C.geo}`,
            transition: `left 0.3s cubic-bezier(0.32,0.72,0,1)`,
            pointerEvents: 'none',
          }} />
        )}

        {NAV_ITEMS.map((item, idx) => {
          if (!item) {
            return (
              <div key="scan" style={{
                flex: 1.2, display: 'flex', justifyContent: 'center',
                alignItems: 'flex-end', paddingBottom: 6,
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
                alignItems: 'center', gap: 4, padding: '10px 0 9px',
                textDecoration: 'none', position: 'relative',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <item.Icon
                key={isActive ? `${item.to}-on` : `${item.to}-off`}
                size={22}
                strokeWidth={isActive ? 2.25 : 1.75}
                color={isActive ? C.geo : C.t3}
                style={{
                  display: 'block',
                  animation: isActive ? 'iconBounce 0.22s ease both' : 'none',
                  transition: 'color 0.18s',
                }}
              />
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                color: isActive ? C.geo : C.t3,
                transition: 'color 0.18s',
                textTransform: 'uppercase',
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

function AppLayout() {
  const location   = useLocation();
  const navigate   = useNavigate();
  const { pathname } = location;

  // Keep navigate in a ref — stable across re-renders, safe to call from setTimeout
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Log every route change so we can see if BrowserRouter responds to navigation
  useEffect(() => {
    console.log('[ROUTER:CHANGE] pathname:', pathname, '| search:', location.search, '| hash:', window.location.hash);
  }, [location]);

  // Owned by AppLayout — called by ScanQrButton → BottomNav → here
  // Using navigateRef means no useEffect cleanup can ever cancel this timeout
  function handleQrResult(result) {
    console.log('[QR:RECEIVED_BY_LAYOUT] token:', result.token, 'promo:', result.promo, 'geohunt:', result.geohunt);
    const qs = new URLSearchParams({ token: result.token });
    if (result.promo)   qs.set('promo',   '1');
    if (result.geohunt) qs.set('geohunt', '1');
    const target = `/checkin?${qs.toString()}`;
    console.log('[QR:NAVIGATE_SCHEDULED] target:', target, '| in 400ms');
    setTimeout(() => {
      console.log('[QR:NAVIGATE_EXEC] navigate() calling with:', target, '| current pathname:', window.location.pathname);
      navigateRef.current(target);
    }, 400);
  }

  const hasNav   = pathname !== '/checkin' && pathname !== '/withdraw' && pathname !== '/legal' && pathname !== '/channel-reward';
  const isSAPage = pathname === '/superadmin';

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: "'Barlow Condensed', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: C.t1,
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        maxWidth: 480, margin: '0 auto',
        paddingBottom: hasNav ? 80 : 0,
        height: isSAPage ? 'auto' : undefined,
      }}>
        <Routes>
          <Route path="/"                element={<Home />} />
          <Route path="/checkin"         element={<Checkin />} />
          <Route path="/balance"         element={<Balance />} />
          <Route path="/withdraw"        element={<Withdraw />} />
          <Route path="/game"            element={<Game />} />
          <Route path="/admin"           element={<Admin />} />
          <Route path="/superadmin"      element={<SuperAdmin />} />
          <Route path="/legal"           element={<Legal />} />
          <Route path="/channel-reward"  element={<ChannelSub />} />
        </Routes>
      </div>
      <BottomNav onQrResult={handleQrResult} />
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
