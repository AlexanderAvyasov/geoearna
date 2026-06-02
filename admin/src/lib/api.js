const BASE = import.meta.env.VITE_API_BASE || '';

export function getToken()  { return localStorage.getItem('ga_token') || ''; }
export function setToken(t) { localStorage.setItem('ga_token', t); }
export function clearToken(){ localStorage.removeItem('ga_token'); }
export function isLoggedIn(){ return !!getToken(); }

async function req(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('UNAUTHORIZED');
  }
  return res;
}

export const api = {
  get:    path       => req(path),
  post:   (path, b)  => req(path, { method: 'POST',   body: b }),
  patch:  (path, b)  => req(path, { method: 'PATCH',  body: b }),
  delete: path       => req(path, { method: 'DELETE' }),
};

export async function login(password) {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || 'LOGIN_FAILED');
  }
  const { token } = await res.json();
  setToken(token);
  return token;
}
