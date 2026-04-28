import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet's default marker icon broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const brandIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width:32px;height:32px;background:#16a34a;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);border:3px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,0.3);">
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -34],
});

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng]); }, [lat, lng]);
  return null;
}

interface SinglePinMapProps {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
}

export function SinglePinMap({ lat, lng, label, className = 'h-48 w-full rounded-2xl overflow-hidden' }: SinglePinMapProps) {
  return (
    <div className={className} style={{ isolation: 'isolate' }}>
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={brandIcon}>
          {label && <Popup>{label}</Popup>}
        </Marker>
        <RecenterMap lat={lat} lng={lng} />
      </MapContainer>
    </div>
  );
}

interface ListingPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  photo?: string;
  onClick?: () => void;
}

interface MultiPinMapProps {
  pins: ListingPin[];
  center?: [number, number];
  zoom?: number;
  className?: string;
}

export function MultiPinMap({ pins, center, zoom = 13, className = 'h-full w-full' }: MultiPinMapProps) {
  const defaultCenter: [number, number] = center || (pins.length > 0 ? [pins[0].lat, pins[0].lng] : [33.888, 35.5]);

  return (
    <div className={className}>
      <MapContainer
        center={defaultCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map(pin => (
          <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={brandIcon}
            eventHandlers={{ click: () => pin.onClick?.() }}>
            <Popup>
              <div className="text-sm font-semibold">{pin.title}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
