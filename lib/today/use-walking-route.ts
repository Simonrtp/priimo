'use client';

import { useEffect, useMemo, useState } from 'react';
import { MAPBOX_TOKEN } from '@/lib/map/style';
import { readDevicePosition } from '@/lib/voice/gps';
import {
  fetchWalkingRoute,
  routeWaypoints,
  type ItineraireStop,
  type RoutePoint,
  type WalkingRoute,
} from '@/lib/today/directions';

export function useWalkingRoute(stops: readonly ItineraireStop[] | null) {
  const [origin, setOrigin] = useState<RoutePoint | null>(null);
  const [route, setRoute] = useState<WalkingRoute | null>(null);

  useEffect(() => {
    void readDevicePosition().then(setOrigin);
  }, []);

  const waypoints = useMemo(
    () => (stops && stops.length > 0 ? routeWaypoints(stops, origin) : []),
    [stops, origin],
  );

  useEffect(() => {
    let cancelled = false;
    if (waypoints.length < 2 || !MAPBOX_TOKEN) {
      setRoute(null);
      return;
    }
    void fetchWalkingRoute(waypoints, MAPBOX_TOKEN).then((next) => {
      if (!cancelled) setRoute(next);
    });
    return () => {
      cancelled = true;
    };
  }, [waypoints]);

  return { route, waypoints, origin };
}
