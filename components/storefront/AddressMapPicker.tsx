'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, LocateFixed, Search, Loader2 } from 'lucide-react';

/**
 * Interactive address picker for the storefront buyer. OpenStreetMap + Leaflet:
 *  - "Ma position" → HTML5 geolocation
 *  - draggable pin → fine-tune the exact spot
 *  - search box → forward geocode (Nominatim)
 *  - reverse geocode on every pin move → fills the text address + city
 * Calls onChange({ address, latitude, longitude, city }) on every change.
 * Loaded via next/dynamic({ ssr:false }) (Leaflet needs window).
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

const DEFAULT_POS = { latitude: 6.1725, longitude: 1.2314 }; // Cotonou

export interface AddressValue {
  address: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
}

async function reverseGeocode(lat: number, lng: number): Promise<{ address: string; city: string | null } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Omnigestion/1.0 (storefront)' } });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    const street = [a.road, a.house_number, a.neighbourhood, a.suburb].filter(Boolean).join(', ');
    const city = a.city || a.town || a.village || a.county || a.state || null;
    const address = street || data.display_name?.split(',').slice(0, 2).join(', ') || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    return { address, city };
  } catch {
    return null;
  }
}

async function forwardGeocode(q: string): Promise<{ latitude: number; longitude: number; address: string; city: string | null } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Omnigestion/1.0 (storefront)' } });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = Array.isArray(data) && data[0];
    if (!hit) return null;
    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
    const rev = await reverseGeocode(latitude, longitude);
    return { latitude, longitude, address: rev?.address || hit.display_name || q, city: rev?.city ?? null };
  } catch {
    return null;
  }
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom() || 15, 15), { animate: true });
  }, [lat, lng, map]);
  return null;
}

function DraggableMarker({ position, onMove }: { position: [number, number]; onMove: (lat: number, lng: number) => void }) {
  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const m = markerRef.current;
        if (!m) return;
        const ll = (m as any).getLatLng();
        onMove(ll.lat, ll.lng);
      },
    }),
    [onMove]
  );
  return <Marker draggable eventHandlers={eventHandlers} position={position} ref={markerRef as any} icon={pinIcon} />;
}

export default function AddressMapPicker({
  initial,
  onChange,
}: {
  initial?: AddressValue | null;
  onChange: (v: AddressValue) => void;
}) {
  const [pos, setPos] = useState({ latitude: initial?.latitude ?? DEFAULT_POS.latitude, longitude: initial?.longitude ?? DEFAULT_POS.longitude });
  const [address, setAddress] = useState(initial?.address ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onChange({ address, latitude: pos.latitude, longitude: pos.longitude, city });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, pos.latitude, pos.longitude, city]);

  const doReverse = async (lat: number, lng: number) => {
    setBusy(true);
    const r = await reverseGeocode(lat, lng);
    if (r) {
      setAddress(r.address);
      setCity(r.city ?? '');
    }
    setBusy(false);
  };

  const useMyPosition = () => {
    if (!('geolocation' in navigator)) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const c = { latitude: p.coords.latitude, longitude: p.coords.longitude };
        setPos(c);
        await doReverse(c.latitude, c.longitude);
      },
      () => setBusy(false),
      { enableHighAccuracy: true }
    );
  };

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    const r = await forwardGeocode(query);
    if (r) {
      setPos({ latitude: r.latitude, longitude: r.longitude });
      setAddress(r.address);
      setCity(r.city ?? '');
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border px-2">
          <input
            className="h-10 flex-1 bg-transparent text-sm outline-none"
            placeholder="Rechercher une adresse, un quartier…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
          />
          <button type="button" onClick={search} className="text-muted-foreground hover:text-foreground">
            <Search className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={useMyPosition}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
        >
          <LocateFixed className="h-4 w-4" /> Ma position
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ height: 320 }}>
        <MapContainer center={[pos.latitude, pos.longitude]} zoom={15} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter lat={pos.latitude} lng={pos.longitude} />
          <DraggableMarker position={[pos.latitude, pos.longitude]} onMove={(lat, lng) => { setPos({ latitude: lat, longitude: lng }); doReverse(lat, lng); }} />
        </MapContainer>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-sm">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1">
          {busy ? (
            <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Géocodage…</span>
          ) : (
            <>
              <input
                className="w-full bg-transparent font-medium outline-none"
                placeholder="Adresse (déplacée depuis la carte)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <input
                className="mt-1 w-full bg-transparent text-xs text-muted-foreground outline-none"
                placeholder="Ville"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Glissez le point pour ajuster. {pos.latitude.toFixed(5)}, {pos.longitude.toFixed(5)}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
