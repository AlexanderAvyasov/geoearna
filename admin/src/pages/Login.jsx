import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { login, isLoggedIn } from '../lib/api.js';
import { C } from '../lib/design.js';

export default function Login() {
  const navigate  = useNavigate();
  const [pw,  setPw]  = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  if (isLoggedIn()) { navigate('/', { replace: true }); return null; }

  async function submit(e) {
    e.preventDefault();
    if (!pw.trim()) return;
    setBusy(true); setErr('');
    try {
      await login(pw.trim());
      navigate('/', { replace: true });
    } catch (ex) {
      setErr(ex.message === 'INVALID_PASSWORD' ? 'Неверный пароль' : 'Ошибка сервера');
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.bg,
    }}>
      {/* ambient glow */}
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(201,234,26,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: 380, padding: '40px 36px',
        background: C.surf, border: `1px solid ${C.border}`,
        borderRadius: 20,
        boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 14px',
            background: C.accentD, border: `1px solid ${C.accentGl}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MapPin size={22} color={C.accent} strokeWidth={2.5} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, letterSpacing: -0.5 }}>
            Geo<span style={{ color: C.accent }}>Earn</span>
          </div>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Панель администратора</div>
        </div>

        <form onSubmit={submit}>
          <label style={{ display: 'block', fontSize: 12, color: C.t3, fontWeight: 600, letterSpacing: 0.3, marginBottom: 8 }}>
            ПАРОЛЬ
          </label>
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <div style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: C.t3, pointerEvents: 'none',
            }}>
              <Lock size={15} />
            </div>
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={e => { setPw(e.target.value); setErr(''); }}
              placeholder="Введите пароль"
              style={{
                width: '100%', padding: '12px 44px 12px 40px',
                background: C.card, border: `1px solid ${err ? C.red : C.border}`,
                borderRadius: 10, color: C.t1, fontSize: 14,
                outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={e  => { if (!err) e.target.style.borderColor = C.accentGl; }}
              onBlur={e   => { if (!err) e.target.style.borderColor = C.border; }}
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: C.t3, padding: 4,
              }}
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {err && (
            <div style={{ fontSize: 13, color: C.red, marginBottom: 14, textAlign: 'center' }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !pw.trim()}
            style={{
              width: '100%', padding: '13px',
              background: busy || !pw.trim() ? 'rgba(201,234,26,0.25)' : C.accent,
              border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              color: busy || !pw.trim() ? C.t3 : '#07101C',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
          >
            {busy && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
            {busy ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
