function toRad(value) {
  return (value * Math.PI) / 180;
}

function getDistance(a, b) {
  const lat1 = parseFloat(a.lat);
  const lon1 = parseFloat(a.lng);
  const lat2 = parseFloat(b.lat);
  const lon2 = parseFloat(b.lng);

  const earthRadius = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const aFormula = sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(aFormula), Math.sqrt(1 - aFormula));

  return Math.round(earthRadius * c * 1000);
}

module.exports = {
  getDistance,
};
