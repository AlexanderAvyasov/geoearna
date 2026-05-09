// Single source of truth for GEO_RATE.
// Set GEO_RATE in Railway environment variables (e.g. GEO_RATE=1000).
// Default fallback is 1000 UZS per 1 GEO.
function getGeoRate() {
  const raw = parseFloat(process.env.GEO_RATE);
  return Number.isFinite(raw) && raw > 0 ? raw : 1000;
}

module.exports = { getGeoRate };
