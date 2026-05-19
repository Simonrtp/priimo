'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cleanupLeafletContainer } from '@/lib/leaflet-cleanup';
import { scoreMarkerColor, type LeadMapPoint } from '@/lib/lead-map';
import 'leaflet/dist/leaflet.css';

interface AgencyZone {
  latitude: number;
  longitude: number;
  radiusKm: number | null;
}

interface LeadsMapCanvasProps {
  points: LeadMapPoint[];
  selectedLeadId: string | null;
  onLeadSelect: (id: string) => void;
  agencyZone?: AgencyZone | null;
}

function MapCleanup() {
  const map = useMap();

  useEffect(() => {
    return () => {
      map.remove();
    };
  }, [map]);

  return null;
}

function MapBounds({
  points,
  fallback,
}: {
  points: { latitude: number; longitude: number }[];
  fallback?: { latitude: number; longitude: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 14);
      return;
    }
    if (fallback) {
      map.setView([fallback.latitude, fallback.longitude], 12);
    }
  }, [points, fallback, map]);

  return null;
}

export default function LeadsMapCanvas({
  points,
  selectedLeadId,
  onLeadSelect,
  agencyZone,
}: LeadsMapCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mapKey] = useState(() => `leads-map-${Math.random().toString(36).slice(2)}`);

  const initialCenter = useMemo(() => {
    if (points.length > 0) {
      return [points[0].latitude, points[0].longitude] as [number, number];
    }
    if (agencyZone) {
      return [agencyZone.latitude, agencyZone.longitude] as [number, number];
    }
    return [48.8566, 2.3522] as [number, number];
  }, [points, agencyZone]);

  const zoneRadiusM =
    agencyZone?.radiusKm != null && agencyZone.radiusKm > 0
      ? agencyZone.radiusKm * 1000
      : null;

  useEffect(() => {
    return () => {
      cleanupLeafletContainer(hostRef.current);
    };
  }, []);

  return (
    <div ref={hostRef} className="relative z-0 w-full" style={{ height: 480, minHeight: 360 }}>
      <MapContainer
        key={mapKey}
        center={initialCenter}
        zoom={12}
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapCleanup />

        <MapBounds
          points={points}
          fallback={
            agencyZone
              ? { latitude: agencyZone.latitude, longitude: agencyZone.longitude }
              : null
          }
        />

        {zoneRadiusM != null && agencyZone && (
          <Circle
            center={[agencyZone.latitude, agencyZone.longitude]}
            radius={zoneRadiusM}
            pathOptions={{
              color: '#E97B3D',
              weight: 2,
              fillColor: '#F4A462',
              fillOpacity: 0.08,
            }}
          />
        )}

        {points.map((point) => {
          const isSelected = point.leadId === selectedLeadId;
          const color = scoreMarkerColor(point.score);
          return (
            <Circle
              key={point.leadId}
              center={[point.latitude, point.longitude]}
              radius={isSelected ? 55 : 42}
              pathOptions={{
                color: isSelected ? '#111827' : color,
                weight: isSelected ? 3 : 2,
                fillColor: color,
                fillOpacity: isSelected ? 0.95 : 0.82,
              }}
              eventHandlers={{
                click: () => onLeadSelect(point.leadId),
              }}
            >
              <Popup>
                <div className="min-w-[180px] space-y-2 p-0.5">
                  <p className="font-semibold text-ink" style={{ fontSize: 13 }}>
                    Score {point.score}
                  </p>
                  <p className="text-mute leading-snug" style={{ fontSize: 12 }}>
                    {point.address}
                  </p>
                  <button
                    type="button"
                    className="w-full rounded-lg bg-accent px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-accent-dark"
                    onClick={() => onLeadSelect(point.leadId)}
                  >
                    Voir la fiche
                  </button>
                </div>
              </Popup>
            </Circle>
          );
        })}
      </MapContainer>
    </div>
  );
}
