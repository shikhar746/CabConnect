const axios = require('axios');
const env = require('../../config/env');
const { round } = require('../../utils/geo');

/** Real Google Maps adapter. Activated with MAPS_PROVIDER=google and GOOGLE_MAPS_API_KEY. */
const key = () => {
  if (!env.googleMapsApiKey || env.googleMapsApiKey.startsWith('REPLACE')) throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  return env.googleMapsApiKey;
};

const http = axios.create({ baseURL: 'https://maps.googleapis.com/maps/api', timeout: 8000 });

/** Decodes Google's encoded polyline format. */
function decodePolyline(str) {
  const points = [];
  let index = 0; let lat = 0; let lng = 0;
  while (index < str.length) {
    let b; let shift = 0; let result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

module.exports = {
  name: 'google',

  async search(query, near) {
    const { data } = await http.get('/place/textsearch/json', {
      params: { query, key: key(), ...(near && { location: `${near.lat},${near.lng}`, radius: 30000 }) },
    });
    return (data.results || []).slice(0, 8).map((r) => ({
      address: r.formatted_address || r.name,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
    }));
  },

  async reverseGeocode({ lat, lng }) {
    const { data } = await http.get('/geocode/json', { params: { latlng: `${lat},${lng}`, key: key() } });
    return { address: data.results?.[0]?.formatted_address || `${lat}, ${lng}`, lat, lng };
  },

  async route(points) {
    const fmt = (p) => `${p.lat},${p.lng}`;
    const { data } = await http.get('/directions/json', {
      params: {
        origin: fmt(points[0]),
        destination: fmt(points[points.length - 1]),
        waypoints: points.slice(1, -1).map(fmt).join('|') || undefined,
        key: key(),
      },
    });
    if (data.status !== 'OK') throw new Error(`Directions API error: ${data.status}`);
    const legs = data.routes[0].legs;
    return {
      distanceKm: round(legs.reduce((s, l) => s + l.distance.value, 0) / 1000, 2),
      durationMin: Math.round(legs.reduce((s, l) => s + l.duration.value, 0) / 60),
      path: decodePolyline(data.routes[0].overview_polyline.points),
    };
  },

  decodePolyline,
};
