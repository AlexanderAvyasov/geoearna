import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, Megaphone, Gift,
  Crosshair, Building2, MessageSquare, TrendingUp, LogOut,
  Menu, Bell, ChevronRight, MapPin,
} from 'lucide-react';
import { C, SW, SWC, TH } from '../lib/design.js';
import { clearToken } from '../lib/api.js';

const NAV = [
  { path: '/',             label: 'Дашборд',      Icon: LayoutDashboard },
  { path: '/users',        label: 'Пользователи', Icon: Users },
  { path: '/withdrawals',  label: 'Выплаты',       Icon: CreditCard },
  { path: '/campaigns',    label: 'Кампании',      Icon: Megaphone },
  { path: '/promo',        label: 'Promo QR',      Icon: Gift },
  { path: '/geohunts',     label: 'GeoHunts',      Icon: Crosshair },
  { path: '/applications', label: 'Заявки',        Icon: Building2 },
  { path: '/support',      label: 'Поддержка',     Icon: MessageSquare },
  { path: '/economics',    label: 'Финансы',       Icon: TrendingUp },
];

export default function Layout({ children }) {
  const navigate  = useNavigate();
  const { pathname } = useLocation();
  const [col, setCol] = useState(false);

  const sw = col ? SWC : SW;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: sw, flexShrink: 0,
        background: C.surf,
        borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.18s ease',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          height: TH, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: col ? '0 16px' : '0 18px',
          borderBottom: `1px solid ${C.border}`, gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: C.accentD, border: `1px solid ${C.accentGl}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MapPin size={14} color={C.accent} strokeWidth={2.5} />
          </div>
          {!col && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, letterSpacing: -0.3, lineHeight: 1 }}>
                Geo<span style={{ color: C.accent }}>Earn</span>
              </div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 1 }}>Super Admin</div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
          {NAV.map(({ path, label, Icon }) => {
            const active = path === '/' ? pathname === '/' : pathname.startsWith(path);
            return (
              <div
                key={path}
                onClick={() => navigate(path)}
                title={col ? label : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px',
                  margin: '1px 8px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: active ? C.accentD : 'transparent',
                  color:  active ? C.accent : C.t2,
                  transition: 'all 0.14s',
                  whiteSpace: 'nowrap', userSelect: 'none',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? C.accentD : 'transparent'; }}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
                {!col && (
                  <>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, flex: 1 }}>{label}</span>
                    {active && <ChevronRight size={12} style={{ opacity: 0.4 }} />}
                  </>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '8px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div
            onClick={() => { clearToken(); navigate('/login'); }}
            title={col ? 'Выйти' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 8px', borderRadius: 8,
              cursor: 'pointer', color: C.t3, transition: 'color 0.14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = C.red; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.t3; }}
          >
            <LogOut size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            {!col && <span style={{ fontSize: 13 }}>Выйти</span>}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          height: TH, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 12,
          background: C.surf, borderBottom: `1px solid ${C.border}`,
        }}>
          <button
            onClick={() => setCol(c => !c)}
            style={{
              background: 'none', border: 'none',
              color: C.t2, display: 'flex', padding: 6,
              borderRadius: 6, transition: 'background 0.14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            <Menu size={18} />
          </button>

          <div style={{ flex: 1 }} />

          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: C.card, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: C.t2,
          }}>
            <Bell size={15} />
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 10px', borderRadius: 8,
            background: C.card, border: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: C.accentD, border: `1px solid ${C.accentGl}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: C.accent,
            }}>SA</div>
            <span style={{ fontSize: 13, color: C.t2, fontWeight: 500 }}>Super Admin</span>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
