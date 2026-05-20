'use client';

import { useMemo } from 'react';

interface ZoneRadiusMapProps {
  latitude: number;
  longitude: number;
  radiusKm: number;
  className?: string;
}

function bboxFromCenter(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

export default function ZoneRadiusMap({
  latitude,
  longitude,
  radiusKm,
  className = '',
}: ZoneRadiusMapProps) {
  const embedUrl = useMemo(() => {
    const { minLat, maxLat, minLng, maxLng } = bboxFromCenter(latitude, longitude, radiusKm);
    const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
    const marker = `${latitude},${longitude}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
  }, [latitude, longitude, radiusKm]);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-black/10 bg-[#f4f4f2] ${className}`}
      aria-label="Aperçu carte de la zone"
    >
      <iframe
        title="Carte OpenStreetMap de la zone"
        src={embedUrl}
        className="h-[220px] w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="border-t border-black/[0.06] bg-white px-3 py-2 text-center text-xs text-mute">
        Aperçu approximatif — rayon {radiusKm % 1 === 0 ? radiusKm : radiusKm.toFixed(1)} km
      </p>
    </div>
  );
}
