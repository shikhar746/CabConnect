import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@chakra-ui/react';

export const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }; // Bengaluru

const pin = (color, label) => L.divIcon({
  className: '',
  html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.25)"><span style="transform:rotate(45deg);color:#fff;font:700 12px Inter,sans-serif">${label}</span></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const requestIcon = (label) => L.divIcon({
  className: '',
  html: `<div style="transform:translate(-50%,-100%);display:inline-block;white-space:nowrap;padding:3px 8px;border-radius:999px;background:#B45309;color:#fff;font:700 12px Inter,sans-serif;border:2px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.25)">${label}</div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

const carIcon = L.divIcon({
  className: '',
  html: '<div style="width:38px;height:38px;border-radius:50%;background:#0F172A;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:18px">🚖</div>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const driverDot = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#0F172A;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:11px;display:flex;align-items:center;justify-content:center">🚗</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function FitBounds({ points }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 14, { animate: true });
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/**
 * Leaflet + OpenStreetMap map (no API key needed). Shows pickup (P), stops (1..n),
 * drop-off (D), the route polyline, the live driver position and optional nearby drivers.
 */
export default function RideMap({ pickup, stops = [], dropoff, path, driver, nearbyDrivers = [], requests = [], onMapClick, height = '420px', followDriver = false }) {
  const fitPoints = useMemo(() => {
    if (followDriver && driver) return [driver, ...(pickup ? [pickup] : [])].slice(0, 2);
    return [pickup, ...stops, dropoff, ...requests, ...(requests.length && driver ? [driver] : [])].filter(Boolean);
  }, [pickup, stops, dropoff, requests, driver, followDriver]);

  return (
    <Box h={height} w="100%" borderRadius="card" overflow="hidden" borderWidth="1px" borderColor="border.subtle" position="relative">
      <MapContainer center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {path?.length > 1 && (
          <>
            <Polyline positions={path.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#0F172A', weight: 7, opacity: 0.15 }} />
            <Polyline positions={path.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#0D9488', weight: 4 }} />
          </>
        )}
        {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pin('#0D9488', 'P')}><Tooltip>{pickup.address}</Tooltip></Marker>}
        {stops.map((s, i) => <Marker key={`${s.lat}-${i}`} position={[s.lat, s.lng]} icon={pin('#D97706', i + 1)}><Tooltip>{s.address}</Tooltip></Marker>)}
        {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={pin('#0F172A', 'D')}><Tooltip>{dropoff.address}</Tooltip></Marker>}
        {driver && <Marker position={[driver.lat, driver.lng]} icon={carIcon} zIndexOffset={1000}><Tooltip>Your driver</Tooltip></Marker>}
        {nearbyDrivers.map((d) => <Marker key={d.id} position={[d.lat, d.lng]} icon={driverDot} />)}
        {requests.map((r) => <Marker key={r.id} position={[r.lat, r.lng]} icon={requestIcon(r.label)}><Tooltip>Pickup: {r.address}</Tooltip></Marker>)}
        <FitBounds points={fitPoints} />
        {onMapClick && <ClickHandler onClick={onMapClick} />}
      </MapContainer>
    </Box>
  );
}
