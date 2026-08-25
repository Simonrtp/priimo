'use client';

import { Navigation } from 'lucide-react';
import {
  formatWalkingDuration,
  googleMapsWalkingUrl,
  type ItineraireStop,
  type RoutePoint,
  type WalkingRoute,
} from '@/lib/today/directions';
import { formatDistance } from '@/lib/today/field';

export default function ItineraireBanner({
  stops,
  waypoints,
  route,
  className = '',
}: {
  stops: readonly ItineraireStop[];
  waypoints: readonly RoutePoint[];
  route: WalkingRoute | null;
  className?: string;
}) {
  const n = stops.length;
  const mapsHref = googleMapsWalkingUrl(waypoints.length >= 2 ? waypoints : stops);
  const dist = route ? formatDistance(route.distanceM) : null;
  const duration = route ? formatWalkingDuration(route.durationS) : null;

  return (
    <div
      className={`flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/95 px-3 py-1.5 shadow-md ${className}`}
    >
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-text-strong">
        Tournée · {n} arrêt{n > 1 ? 's' : ''}
        {dist && duration ? ` · ${duration} · ${dist}` : ''}
      </p>
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 text-[12.5px] font-semibold text-white"
      >
        <Navigation size={14} strokeWidth={2.2} aria-hidden />
        Naviguer
      </a>
    </div>
  );
}
