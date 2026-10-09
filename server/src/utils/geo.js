const R = 6371; // Earth radius km
const toRad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in km between {lat,lng} points. */
function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Linear interpolation between two points, n intermediate steps (inclusive of end). */
function interpolate(a, b, steps) {
  const pts = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    pts.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  return pts;
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

module.exports = { haversineKm, interpolate, round };
