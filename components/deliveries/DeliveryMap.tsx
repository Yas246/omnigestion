'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * OpenStreetMap + Leaflet map for deliveries. Shows the destination pin, an
 * optional live driver position, and an optional OSRM route polyline. Loaded
 * via next/dynamic({ ssr:false }) from the pages (Leaflet needs `window`).
 */

// Inline SVG teardrop pin (no external image → no CSP img-src issue, always
// renders). Tip anchored at the exact coordinate.
const pinIcon = L.divIcon({
  html: `<svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" style="color:#dc2626;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 0 0 5z"/></svg>`,
  className: '',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});
const driverIcon = L.divIcon({
  html: '<div style="background:#16a34a;border:3px solid white;border-radius:9999px;width:18px;height:18px;box-shadow:0 0 0 2px rgba(0,0,0,.2)"></div>',
  className: '',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** Recenter the map when the target changes. */
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom() || 14, { animate: true });
  }, [lat, lng, map]);
  return null;
}

/** Fit the map to show the destination + driver (and the route between) once
 *  both are present. Refits only when the destination/route availability
 *  changes — NOT on every driver move, so the user's manual zoom is preserved. */
function FitBounds({
  dest,
  driver,
  hasRoute,
}: {
  dest: [number, number];
  driver: [number, number] | null;
  hasRoute: boolean;
}) {
  const map = useMap();
  const lastKey = useRef('');
  useEffect(() => {
    const key = `${dest[0]},${dest[1]}|${hasRoute ? 'r' : 'n'}|${driver ? 'd' : 'n'}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    const pts: [number, number][] = [dest];
    if (driver) pts.push(driver);
    if (pts.length >= 2) map.fitBounds(pts as any, { padding: [40, 40], maxZoom: 16 });
  }, [dest, driver, hasRoute, map]);
  return null;
}

export interface DeliveryMapProps {
  /** Destination (customer) coordinates. */
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  /** Optional live driver position. */
  driver?: { latitude: number; longitude: number; label?: string } | null;
  /** Optional route as an array of [lat, lng] points (OSRM polyline). */
  route?: Array<[number, number]> | null;
  height?: number | string;
  className?: string;
}

export default function DeliveryMap({
  latitude,
  longitude,
  address,
  driver,
  route,
  height = 320,
  className,
}: DeliveryMapProps) {
  const center = useMemo<[number, number]>(() => {
    const lat = latitude ?? driver?.latitude ?? 6.1725; // Cotonou fallback
    const lng = longitude ?? driver?.longitude ?? 1.2314;
    return [lat, lng];
  }, [latitude, longitude, driver?.latitude, driver?.longitude]);

  const destPoint = latitude != null && longitude != null ? ([latitude, longitude] as [number, number]) : null;
  const driverPoint = driver ? ([driver.latitude, driver.longitude] as [number, number]) : null;

  return (
    <div className={className} style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden', position: 'relative', isolation: 'isolate' }}>
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {destPoint && driverPoint ? (
          <FitBounds dest={destPoint} driver={driverPoint} hasRoute={!!(route && route.length > 1)} />
        ) : (
          <Recenter lat={center[0]} lng={center[1]} />
        )}
        {latitude != null && longitude != null && (
          <Marker position={[latitude, longitude]} icon={pinIcon}>
            {address ? <Popup>{address}</Popup> : null}
          </Marker>
        )}
        {driver && (
          <Marker position={[driver.latitude, driver.longitude]} icon={driverIcon}>
            {driver.label ? <Popup>{driver.label}</Popup> : null}
          </Marker>
        )}
        {route && route.length > 1 && <Polyline positions={route} pathOptions={{ color: '#2563eb', weight: 4 }} />}
      </MapContainer>
    </div>
  );
}
