import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import Home from './pages/Home';
import Checkin from './pages/Checkin';
import Balance from './pages/Balance';
import Withdraw from './pages/Withdraw';

function BottomNav() {
  const { pathname } = useLocation();
  if (pathname === '/checkin' || pathname === '/withdraw') return null;

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
    })}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
    </NavLink>
  );

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(0,0,0,0.08)',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom, 6px)',
      zIndex: 100,
    }}>
      {navItem('/', '🏠', 'ГЛАВНАЯ')}
      {navItem('/balance', '💼', 'БАЛАНС')}
    </nav>
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
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: hasNav ? 72 : 0 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/checkin" element={<Checkin />} />
          <Route path="/balance" element={<Balance />} />
          <Route path="/withdraw" element={<Withdraw />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}

export default function App() {
  useTelegram();
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
