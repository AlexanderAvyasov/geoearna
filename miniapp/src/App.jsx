import { useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTelegram, tg } from './hooks/useTelegram';
import Home from './pages/Home';
import Checkin from './pages/Checkin';
import Balance from './pages/Balance';
import Withdraw from './pages/Withdraw';
import Admin from './pages/Admin';
import Onboarding from './pages/Onboarding';

const ANIM = `
  @keyframes scanPulse {
    0%,100% { box-shadow: 0 4px 20px rgba(42,171,238,0.5); }
    50%      { box-shadow: 0 4px 32px rgba(42,171,238,0.85); }
  }
  @keyframes toastIn {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }
`;

function parseToken(raw) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const t = url.searchParams.get('token');
    if (t) return t;
  } catch {
    // not a URL — raw string might be the token itself
  }
  // Accept plain token strings (no spaces, reasonable length)
  if (/^[A-Za-z0-9_\-]{8,60}$/.test(raw.trim())) return raw.trim();
  return null;
}

function ScanQrButton({ onToast }) {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);

  function handleScan() {
    if (scanning) return;

    // Telegram WebApp QR Scanner available from v6.4
    if (!tg || !tg.isVersionAtLeast || !tg.isVersionAtLeast('6.4')) {
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
        return true; // close popup
      }
      // invalid QR — keep popup open, let user try again
      return false;
    });

    // Safety: reset scanning state if popup is closed without scan
    setTimeout(() => setScanning(false), 30000);
  }

  return (
    <button
      onClick={handleScan}
      style={{
        position: 'relative',
        bottom: 14,
        width: 60,
        height: 60,
        borderRadius: '50%',
        background: scanning
          ? 'linear-gradient(135deg, #1a8fcc, #0d6fa0)'
          : 'linear-gradient(135deg, #2AABEE, #1a8fcc)',
        border: '3px solid #fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: scanning ? 'not-allowed' : 'pointer',
        animation: scanning ? 'none' : 'scanPulse 2.5s ease-in-out infinite',
        boxShadow: '0 4px 20px rgba(42,171,238,0.5)',
        flexShrink: 0,
        transition: 'transform 0.15s',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
      }}
      onMouseDown={e => { if (!scanning) e.currentTarget.style.transform = 'scale(0.92)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      onTouchStart={e => { if (!scanning) e.currentTarget.style.transform = 'scale(0.92)'; }}
      onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <span style={{ fontSize: scanning ? 24 : 26, lineHeight: 1 }}>
        {scanning ? '⏳' : '📷'}
      </span>
    </button>
  );
}

function Toast({ message }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 90,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(28,28,30,0.92)',
      color: '#fff',
      borderRadius: 12,
      padding: '12px 20px',
      fontSize: 14,
      fontWeight: 600,
      zIndex: 500,
      whiteSpace: 'nowrap',
      animation: 'toastIn 0.25s ease',
      maxWidth: 'calc(100vw - 48px)',
      textAlign: 'center',
    }}>
      {message}
    </div>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const [toast, setToast] = useState(null);

  if (pathname === '/checkin' || pathname === '/withdraw') return null;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  const navItem = (to, icon, label) => (
    <NavLink to={to} style={({ isActive }) => ({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      padding: '10px 0',
      textDecoration: 'none',
      color: isActive ? '#2AABEE' : '#8E8E93',
      transition: 'color 0.15s',
      WebkitTapHighlightColor: 'transparent',
    })}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
    </NavLink>
  );

  return (
    <>
      <style>{ANIM}</style>
      <nav style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'flex-end',
        paddingBottom: 'env(safe-area-inset-bottom, 6px)',
        zIndex: 100,
      }}>
        {navItem('/', '🏠', 'ГЛАВНАЯ')}
        {navItem('/balance', '💼', 'БАЛАНС')}

        <div style={{ flex: 1.2, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 6 }}>
          <ScanQrButton onToast={showToast} />
        </div>

        {navItem('/admin', '🏪', 'БИЗНЕС')}
      </nav>

      {toast && <Toast message={toast} />}
    </>
  );
}

function AppLayout() {
  const { pathname } = useLocation();
  const hasNav = pathname !== '/checkin' && pathname !== '/withdraw';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#EFEFF4',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#1C1C1E',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: hasNav ? 80 : 0 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route path="/balance" element={<Balance />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/admin" element={<Admin />} />
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
    return <Onboarding onDone={() => setOnboarded(true)} />;
  }

  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
