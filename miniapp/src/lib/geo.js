// GEO Economy utilities
// GEO_RATE: how many UZS per 1 GEO (from /api/config)

export function geoToUzs(geo, rate) {
  return Math.round(geo * rate);
}

export function formatGeo(amount) {
  if (amount == null) return '0';
  return Number(amount).toLocaleString('ru-RU');
}

export function formatUzs(amount) {
  if (amount == null) return '0';
  return Number(amount).toLocaleString('ru-RU');
}

// Card number validation for Humo / Uzcard (16 digits)
export function isValidCardNumber(raw) {
  return /^\d{16}$/.test(String(raw).replace(/[\s\-]/g, ''));
}

export function normalizeCardNumber(raw) {
  return String(raw).replace(/[\s\-]/g, '');
}

export function formatCardNumber(raw) {
  const digits = String(raw).replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

export function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}
