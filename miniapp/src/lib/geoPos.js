// Shared geolocation helper with sessionStorage caching.
// Calling getGeoPos() triggers the browser/Telegram permission dialog
// if permission has not been granted yet — no pre-check, no settings redirect.

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

export function clearGeoCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}

// Returns Promise<{ lat, lng }>.
// Uses cache when fresh. On miss — calls getCurrentPosition which:
//   • shows the system permission dialog if permission is 'prompt'
//   • returns immediately if permission is already 'granted'
//   • rejects with err.code === 1 if permission is 'denied' at OS level
export function getGeoPos({ forceRefresh = false } = {}) {
  if (!navigator?.geolocation) {
    return Promise.reject(Object.assign(new Error('UNSUPPORTED'), { code: 0 }));
  }

  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return Promise.resolve(cached);
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        writeCache(lat, lng);
        resolve({ lat, lng });
      },
      err => reject(err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}
