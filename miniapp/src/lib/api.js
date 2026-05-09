export const API_BASE = import.meta.env.VITE_API_URL || '';

// In native Telegram clients, initData arrives via async native bridge.
// Poll until it's available (or 4 s timeout) so we don't send empty auth.
export async function waitForInitData(maxMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const d = window.Telegram?.WebApp?.initData;
    if (d) return d;
    await new Promise(r => setTimeout(r, 50));
  }
  return '';
}

export function getInitData() {
  return window.Telegram?.WebApp?.initData ?? '';
}

export async function apiFetch(path, options = {}) {
  const initdata = await waitForInitData();
  const headers = {
    ...(initdata ? { initdata } : {}),
    ...(options.headers || {}),
  };
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}
