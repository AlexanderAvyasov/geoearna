import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import Home from './pages/Home';
import Checkin from './pages/Checkin';
import Balance from './pages/Balance';
import Withdraw from './pages/Withdraw';

export default function App() {
  useTelegram();

  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh', background: '#f5f7fb', color: '#111' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/checkin" element={<Checkin />} />
            <Route path="/balance" element={<Balance />} />
            <Route path="/withdraw" element={<Withdraw />} />
          </Routes>
        </div>
        <nav
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: '#fff',
            borderTop: '1px solid #ddd',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-around',
          }}
        >
          <Link to="/" style={{ textDecoration: 'none', color: '#1a73e8' }}>
            Главная
          </Link>
          <Link to="/balance" style={{ textDecoration: 'none', color: '#1a73e8' }}>
            Баланс
          </Link>
        </nav>
      </div>
    </BrowserRouter>
  );
}
