import { useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTelegram, tg } from './hooks/useTelegram';
import { C, G, E } from './lib/design';
import Home       from './pages/Home';
import MapPage    from './pages/Map';
import Checkin    from './pages/Checkin';
import Balance    from './pages/Balance';
import Withdraw   from './pages/Withdraw';
import Admin      from './pages/Admin';
import Onboarding from './pages/Onboarding';

export const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root {
    margin: 0; padding: 0;
    background: ${C.bg};
    color: ${C.t1};
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overscroll-behavior: none;
  }
  ::-webkit-scrollbar { display: none; }
  * { scrollbar-width: none; }

  @keyframes pageEnter {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: .3; }
  }
  @keyframes glowPulse {
    0%, 100% { opacity: .6; transform: scale(1); }
    50%       { opacity: 1;  transform: scale(1.08); }
  }
  @keyframes scanRing {
    0%   { box-shadow: 0 0 0 0   rgba(42,171,238,.7), 0 6px 28px rgba(42,171,238,.5); }
    60%  { box-shadow: 0 0 0 12px rgba(42,171,238,0), 0 6px 32px rgba(42,171,238,.7); }
    100% { box-shadow: 0 0 0 0   rgba(42,171,238,0), 0 6px 28px rgba(42,171,238,.5); }
  }
  @keyframes coinBurst {
    0%   { opacity: 1; transform: translate(0,0) scale(1); }
    100% { opacity: 0; transform: translate(var(--tx),var(--ty)) scale(0); }
  }
  @keyframes pop {
    0%   { transform: scale(0.6); opacity: 0; }
    70%  { transform: scale(1.1); }
    100% { transform: scale(1);   opacity: 1; }
  }
  @keyframes ripple {
    to { transform: scale(3); opacity: 0; }
  }
  @keyframes fadeUp {
    from { transform: translateY(16px); opacity: 0; }
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
    0%, 100% { transform: scale(1);   opacity: .8; }
    50%       { transform: scale(1.6); opacity: 0; }
  }
  @keyframes successGlow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(0,230,118,.6); }
    50%       { box-shadow: 0 0 0 20px rgba(0,230,118,0); }
  }
  @keyframes toastIn {
    from { transform: translate(-50%, 12px); opacity: 0; }
    to   { transform: translate(-50%, 0);    opacity: 1; }
  }
  @keyframes navPop {
    0%   { transform: scale(0) translateX(-50%); }
    70%  { transform: scale(1.3) translateX(-38%); }
    100% { transform: scale(1) translateX(-50%); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-6px); }
  }
  @keyframes gradientShift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;

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
        position: 'relative', bottom: 18,
        width: 60, height: 60, borderRadius: '50%',
        background: scanning
          ? 'linear-gradient(135deg, #1a7aaa, #0d5a80)'
          : G.blue,
        border: `2.5px solid ${C.surf}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: scanning ? 'not-allowed' : 'pointer',
        animation: scanning ? 'none' : 'scanRing 2.2s ease-in-out infinite',
        flexShrink: 0,
        transition: `transform 0.12s ${E.spring}`,
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        zIndex: 10,
      }}
      onTouchStart={e => { if (!scanning) e.currentTarget.style.transform = 'scale(0.88)'; }}
      onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseDown={e => { if (!scanning) e.currentTarget.style.transform = 'scale(0.88)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <span style={{ fontSize: 26, lineHeight: 1, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}>
        {scanning ? '⏳' : '📷'}
      </span>
    </button>
  );
}

function Toast({ message }) {
  return (
    <div style={{
      position: 'fixed', bottom: 100, left: '50%',
      transform: 'translate(-50%, 0)',
      background: 'rgba(20,22,30,0.96)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      color: C.t1, borderRadius: 14,
      padding: '12px 22px', fontSize: 14, fontWeight: 600,
      zIndex: 500, whiteSpace: 'nowrap',
      animation: 'toastIn 0.25s ease',
      maxWidth: 'calc(100vw - 48px)', textAlign: 'center',
      border: `1px solid ${C.b1}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      {message}
    </div>
  );
}

const NAV_ITEMS = [
  { to: '/',        icon: '🏠', label: 'Главная' },
  { to: '/map',     icon: '🗺️', label: 'Карта'   },
  null,
  { to: '/balance', icon: '💎', label: 'Кошелёк' },
  { to: '/admin',   icon: '🏪', label: 'Бизнес'  },
];

function BottomNav() {
  const { pathname } = useLocation();
  const [toast, setToast] = useState(null);

  if (pathname === '/checkin' || pathname === '/withdraw') return null;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(8,9,14,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: `1px solid ${C.b1}`,
        display: 'flex', alignItems: 'flex-end',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        zIndex: 100,
        boxShadow: '0 -1px 0 rgba(255,255,255,0.05)',
      }}>
        {NAV_ITEMS.map((item, idx) => {
          if (!item) {
            return (
              <div key="scan" style={{
                flex: 1.3, display: 'flex', justifyContent: 'center',
                alignItems: 'flex-end', paddingBottom: 6,
              }}>
                <ScanQrButton onToast={showToast} />
              </div>
            );
          }

          const isActive = item.to === '/'
            ? pathname === '/'
            : pathname.startsWith(item.to);

          const activeColor = item.to === '/balance' ? C.geo
            : item.to === '/admin' ? C.gold
            : C.blue;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3, padding: '10px 0 8px',
                textDecoration: 'none', position: 'relative',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                fontSize: 22, lineHeight: 1,
                filter: isActive ? 'none' : 'grayscale(1) opacity(0.35)',
                transition: `filter 0.15s, transform 0.15s ${E.spring}`,
                transform: isActive ? 'scale(1.12)' : 'scale(1)',
                display: 'block',
              }}>
                {item.icon}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
                color: isActive ? activeColor : C.t3,
                transition: 'color 0.15s',
                textTransform: 'uppercase',
              }}>
                {item.label}
              </span>
              {isActive && (
                <div style={{
                  position: 'absolute', bottom: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 18, height: 3, borderRadius: 2,
                  background: activeColor,
                  animation: 'navPop 0.25s ease both',
                  boxShadow: `0 0 8px ${activeColor}`,
                }} />
              )}
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
  const hasNav = pathname !== '/checkin' && pathname !== '/withdraw';
  const isMap  = pathname === '/map';

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
      color: C.t1,
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        maxWidth: 480, margin: '0 auto',
        paddingBottom: hasNav && !isMap ? 80 : 0,
        height: isMap ? '100vh' : undefined,
        overflow: isMap ? 'hidden' : undefined,
      }}>
        <Routes>
          <Route path="/"         element={<Home />} />
          <Route path="/map"      element={<MapPage />} />
          <Route path="/checkin"  element={<Checkin />} />
          <Route path="/balance"  element={<Balance />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/admin"    element={<Admin />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  useTelegram();
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem('geo_onboarded'));

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      {!onboarded ? (
        <Onboarding onDone={() => setOnboarded(true)} />
      ) : (
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      )}
    </>
  );
}
