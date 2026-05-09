import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTelegram, tg, user } from './hooks/useTelegram';
import { Home as HomeIcon, Star, ScanLine, Wallet, Store as StoreIcon, Shield, Loader2, MapPin } from 'lucide-react';
import { C, E } from './lib/design';
import { waitForInitData } from './lib/api';
import Home       from './pages/Home';
import Checkin    from './pages/Checkin';
import Balance    from './pages/Balance';
import Withdraw   from './pages/Withdraw';
import Admin      from './pages/Admin';
import SuperAdmin from './pages/SuperAdmin';
import Onboarding from './pages/Onboarding';
import Game       from './pages/Game';
import MapPage    from './pages/Map';
import Legal      from './pages/Legal';

const IS_SUPER_ADMIN = user?.id === 930826522;

export const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root {
    margin: 0; padding: 0;
    background: ${C.bg};
    color: ${C.t1};
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
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
    100% { opacity: 0; transform: translate(var(--tx),var(--ty)) scale(0); }
  }
  @keyframes pop {
    0%   { transform: scale(0.6); opacity: 0; }
    70%  { transform: scale(1.08); }
    100% { transform: scale(1);   opacity: 1; }
  }
  @keyframes ripple {
    to { transform: scale(3); opacity: 0; }
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
  @keyframes navPop {
    0%   { transform: scale(0) translateX(-50%); opacity: 0; }
    70%  { transform: scale(1.2) translateX(-42%); opacity: 1; }
    100% { transform: scale(1) translateX(-50%); opacity: 1; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-5px); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
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
            Зарабатывай, исследуя город
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

function parseToken(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const t = url.searchParams.get('token');
    if (t) return t;
  } catch { /* not a URL */ }
  if (/^[A-Za-z0-9_\-]{8,60}$/.test(raw.trim())) return raw.trim();
  return null;
}

function ScanQrButton({ onToast }) {
  const navigate  = useNavigate();
  const [scanning, setScanning] = useState(false);

  function handleScan() {
    if (scanning) return;
    if (!tg?.isVersionAtLeast?.('6.4')) {
      onToast('Обновите Telegram для сканирования QR');
      return;
    }
    if (typeof tg.showScanQrPopup !== 'function') {
      onToast('Сканер недоступен в этой версии Telegram');
      return;
    }
    setScanning(true);
    tg.showScanQrPopup({ text: 'Наведите на QR-код заведения' }, (scannedText) => {
      const token = parseToken(scannedText);
      if (token) {
        tg.closeScanQrPopup();
        setScanning(false);
        navigate(`/checkin?token=${encodeURIComponent(token)}`);
        return true;
      }
      return false;
    });
    setTimeout(() => setScanning(false), 30000);
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

const NAV_ITEMS = [
  { to: '/',        Icon: HomeIcon,  label: 'Главная'  },
  { to: '/game',    Icon: Star,      label: 'Прогресс' },
  null,
  { to: '/balance', Icon: Wallet,    label: 'Кошелёк'  },
  IS_SUPER_ADMIN
    ? { to: '/superadmin', Icon: Shield,    label: 'SA'      }
    : { to: '/admin',      Icon: StoreIcon, label: 'Бизнес'  },
];

function BottomNav() {
  const { pathname } = useLocation();
  const [toast, setToast] = useState(null);

  if (pathname === '/checkin' || pathname === '/withdraw' || pathname === '/map' || pathname === '/legal') return null;
  if (IS_SUPER_ADMIN && pathname === '/admin') return null;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <>
      <nav style={{
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
        {NAV_ITEMS.map((item) => {
          if (!item) {
            return (
              <div key="scan" style={{
                flex: 1.2, display: 'flex', justifyContent: 'center',
                alignItems: 'flex-end', paddingBottom: 6,
              }}>
                <ScanQrButton onToast={showToast} />
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
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4, padding: '10px 0 9px',
                textDecoration: 'none', position: 'relative',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 24, height: 2, borderRadius: 2,
                  background: C.geo,
                  animation: 'navPop 0.28s ease both',
                }} />
              )}
              <item.Icon
                size={22}
                strokeWidth={isActive ? 2.25 : 1.75}
                color={isActive ? C.geo : C.t3}
                style={{
                  transition: `color 0.18s, transform 0.18s ${E.spring}`,
                  transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  display: 'block',
                }}
              />
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
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
  const { pathname } = useLocation();
  const hasNav  = pathname !== '/checkin' && pathname !== '/withdraw' && pathname !== '/map' && pathname !== '/legal';
  const isSAPage = pathname === '/superadmin';

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: C.t1,
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        maxWidth: 480, margin: '0 auto',
        paddingBottom: hasNav ? 80 : 0,
        height: isSAPage ? 'auto' : undefined,
      }}>
        <Routes>
          <Route path="/"           element={<Home />} />
          <Route path="/checkin"    element={<Checkin />} />
          <Route path="/balance"    element={<Balance />} />
          <Route path="/withdraw"   element={<Withdraw />} />
          <Route path="/game"       element={<Game />} />
          <Route path="/map"        element={<MapPage />} />
          <Route path="/admin"      element={<Admin />} />
          <Route path="/superadmin" element={<SuperAdmin />} />
          <Route path="/legal"      element={<Legal />} />
        </Routes>
      </div>
      <BottomNav />
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

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* Splash screen: shown until ready, fades out when fading=true */}
      {!ready && <SplashScreen fading={fading} />}

      {/* App: render immediately in background so routes & data load during splash */}
      {!onboarded ? (
        <Onboarding onDone={handleOnboardDone} />
      ) : (
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      )}
    </>
  );
}
