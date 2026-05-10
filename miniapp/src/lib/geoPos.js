// Shared geolocation helper with sessionStorage caching and permissions pre-check.
// All pages import getGeoPos() instead of calling navigator.geolocation directly.

const CACHE_KEY = '_geo_pos';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function readCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (c && Date.now() - c.ts < CACHE_TTL) return c;
  } catch {}
  return null;
}

function writeCache(lat, lng) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ lat, lng, ts: Date.now() }));
  } catch {}
}

function rawGet(maxAge) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        writeCache(pos.coords.latitude, pos.coords.longitude);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      err => reject(err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: maxAge }
    );
  });
}

// Returns Promise<{ lat, lng }>.
// Rejects with err.code === 1 (PERMISSION_DENIED) or err.message === 'UNSUPPORTED'.
export function getGeoPos() {
  if (!navigator?.geolocation) {
    return Promise.reject(Object.assign(new Error('UNSUPPORTED'), { code: 0 }));
  }

  const cached = readCache();
  if (cached) return Promise.resolve(cached);

  if (navigator.permissions) {
    return navigator.permissions
      .query({ name: 'geolocation' })
      .then(result => {
        if (result.state === 'denied') {
          return Promise.reject(Object.assign(new Error('PERMISSION_DENIED'), { code: 1 }));
        }
        // 'granted' → browser already has permission, use large maxAge so it returns instantly
        // 'prompt'  → will show the permission dialog once
        return rawGet(result.state === 'granted' ? CACHE_TTL : 0);
      })
      .catch(err => {
        // permissions API threw (some browsers don't support it) — fall back to direct call
        if (err.code === 1) return Promise.reject(err);
        return rawGet(10000);
      });
  }

  return rawGet(10000);
}
