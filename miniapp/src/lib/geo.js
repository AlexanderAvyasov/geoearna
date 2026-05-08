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
