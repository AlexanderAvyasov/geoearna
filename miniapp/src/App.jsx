import { useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTelegram, tg } from './hooks/useTelegram';
import Home      from './pages/Home';
import MapPage   from './pages/Map';
import Checkin   from './pages/Checkin';
import Balance   from './pages/Balance';
import Withdraw  from './pages/Withdraw';
import Admin     from './pages/Admin';
import Onboarding from './pages/Onboarding';

const ANIM = `
  @keyframes scanPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(42,171,238,0.55), 0 4px 20px rgba(42,171,238,0.45); }
    50%      { box-shadow: 0 0 0 8px rgba(42,171,238,0),  0 4px 24px rgba(42,171,238,0.7); }
  }
  @keyframes toastIn {
    from { transform: translate(-50%, 12px); opacity: 0; }
    to   { transform: translate(-50%, 0);    opacity: 1; }
  }
  @keyframes navDot {
    from { transform: scale(0); }
    to   { transform: scale(1); }
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
      onToast('📷 Обновите Telegram для сканирования QR');
      return;
    }
    if (typeof tg.showScanQrPopup !== 'function') {
      onToast('📷 Сканер недоступен в этой версии Telegram');
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
        position: 'relative', bottom: 16,
        width: 58, height: 58, borderRadius: '50%',
        background: scanning
          ? 'linear-gradient(135deg, #1a8fcc, #0d6fa0)'
          : 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
        border: '3px solid #fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: scanning ? 'not-allowed' : 'pointer',
        animation: scanning ? 'none' : 'scanPulse 2.5s ease-in-out infinite',
        flexShrink: 0,
        transition: 'transform 0.12s',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        boxShadow: '0 4px 20px rgba(42,171,238,0.5)',
      }}
      onMouseDown={e => { if (!scanning) e.currentTarget.style.transform = 'scale(0.9)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      onTouchStart={e => { if (!scanning) e.currentTarget.style.transform = 'scale(0.9)'; }}
      onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <span style={{ fontSize: scanning ? 22 : 24, lineHeight: 1 }}>
        {scanning ? '⏳' : '📷'}
      </span>
    </button>
  );
}

function Toast({ message }) {
  return (
    <div style={{
      position: 'fixed', bottom: 94, left: '50%',
      transform: 'translate(-50%, 0)',
      background: 'rgba(28,28,30,0.94)',
      backdropFilter: 'blur(12px)',
      color: '#fff', borderRadius: 14,
      padding: '12px 20px', fontSize: 14, fontWeight: 600,
      zIndex: 500, whiteSpace: 'nowrap',
      animation: 'toastIn 0.25s ease',
      maxWidth: 'calc(100vw - 48px)', textAlign: 'center',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
    }}>
      {message}
    </div>
  );
}

const NAV_ITEMS = [
  { to: '/',       icon: '🏠', label: 'Главная' },
  { to: '/map',    icon: '🗺️', label: 'Карта'   },
  null, // scan button placeholder
  { to: '/balance', icon: '💎', label: 'Кошелёк' },
  { to: '/admin',  icon: '🏪', label: 'Бизнес'  },
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
      <style>{ANIM}</style>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'flex-end',
        paddingBottom: 'env(safe-area-inset-bottom, 6px)',
        zIndex: 100,
        boxShadow: '0 -2px 20px rgba(0,0,0,0.06)',
      }}>
        {NAV_ITEMS.map((item, idx) => {
          if (!item) {
            return (
              <div key="scan" style={{ flex: 1.2, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 6 }}>
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
                alignItems: 'center', gap: 2, padding: '10px 0 8px',
                textDecoration: 'none', position: 'relative',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                fontSize: 22, lineHeight: 1,
                filter: isActive ? 'none' : 'grayscale(0.3) opacity(0.5)',
                transition: 'filter 0.15s, transform 0.15s',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                display: 'block',
              }}>
                {item.icon}
              </span>
              <span style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: 0.2,
                color: isActive ? '#2AABEE' : '#AEAEB2',
                transition: 'color 0.15s',
                textTransform: 'uppercase',
              }}>
                {item.label}
              </span>
              {isActive && (
                <div style={{
                  position: 'absolute', bottom: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%',
                  background: '#2AABEE',
                  animation: 'navDot 0.2s ease',
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
      background: '#EFEFF4',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#1C1C1E',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        maxWidth: 480, margin: '0 auto',
        paddingBottom: hasNav && !isMap ? 80 : 0,
        height: isMap ? '100vh' : undefined,
        overflow: isMap ? 'hidden' : undefined,
      }}>
        <Routes>
          <Route path="/"        element={<Home />} />
          <Route path="/map"     element={<MapPage />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route path="/balance" element={<Balance />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/admin"   element={<Admin />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  useTelegram();
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem('geo_onboarded'));

  if (!onboarded) {
    return <Onboarding onDone={(mode) => {
      setOnboarded(true);
      // mode is already persisted in localStorage by Onboarding
    }} />;
  }

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
