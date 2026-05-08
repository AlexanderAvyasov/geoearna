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

export function isValidUzPhone(raw) {
  const cleaned = String(raw).replace(/[\s\-\(\)]/g, '');
  return /^\+998[0-9]{9}$/.test(cleaned);
}

export function normalizePhone(raw) {
  let cleaned = String(raw).replace(/[\s\-\(\)]/g, '');
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return cleaned;
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
