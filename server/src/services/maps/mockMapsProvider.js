const places = require('./places');
const { haversineKm, round } = require('../../utils/geo');

const ROAD_FACTOR = 1.3; // straight line -> approximate road distance
const AVG_CITY_SPEED_KMH = 24;

/**
 * Builds a gently curved path between two points so the map shows a
 * believable "road" polyline without a routing engine.
 */
function curvedSegment(a, b, steps) {
  const pts = [];
  const dLat = b.lat - a.lat;
  const dLng = b.lng - a.lng;
  // perpendicular offset scaled to segment length
  const bend = 0.12;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const curve = Math.sin(Math.PI * t) * bend;
    pts.push({ lat: a.lat + dLat * t - dLng * curve, lng: a.lng + dLng * t + dLat * curve });
  }
  return pts;
}

module.exports = {
  name: 'mock',

  async search(query, near) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return [];
    const words = q.split(/\s+/);
    let results = places.filter((p) => words.every((w) => p.address.toLowerCase().includes(w)));
    if (near) results = results.map((p) => ({ ...p, distanceKm: round(haversineKm(near, p), 1) })).sort((x, y) => x.distanceKm - y.distanceKm);
    return results.slice(0, 8);
  },

  async reverseGeocode({ lat, lng }) {
    const nearest = places.reduce((best, p) => {
      const d = haversineKm({ lat, lng }, p);
      return !best || d < best.d ? { p, d } : best;
    }, null);
    if (nearest && nearest.d < 0.6) return { address: nearest.p.address, lat, lng };
    return { address: `Near ${nearest.p.address.split(',')[0]} (${lat.toFixed(4)}, ${lng.toFixed(4)})`, lat, lng };
  },

  /** points: ordered [{lat,lng}] (pickup, ...stops, dropoff) */
  async route(points) {
    let distanceKm = 0;
    const path = [{ lat: points[0].lat, lng: points[0].lng }];
    for (let i = 0; i < points.length - 1; i += 1) {
      const seg = haversineKm(points[i], points[i + 1]);
      distanceKm += seg * ROAD_FACTOR;
      path.push(...curvedSegment(points[i], points[i + 1], Math.max(8, Math.min(40, Math.round(seg * 4)))));
    }
    return {
      distanceKm: round(distanceKm, 2),
      durationMin: Math.max(3, Math.round((distanceKm / AVG_CITY_SPEED_KMH) * 60)),
      path,
    };
  },
};
