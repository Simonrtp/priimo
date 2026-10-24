'use client';

import { useEffect, useState } from 'react';
import AgentLocationMarker from '@/components/dashboard/field/AgentLocationMarker';
import { isUsableCoord } from '@/lib/carte/coords';
import { watchDevicePosition, type DevicePosition } from '@/lib/voice/gps';

/**
 * Point GPS isolé : le suivi vit ici, pas dans le parent carte.
 * Évite de re-render tout le canvas (markers, cadastre) à chaque tick.
 */
export default function LiveAgentLocationMarker({
  enabled = true,
  highAccuracy = false,
  minUpdateM = 12,
}: {
  enabled?: boolean;
  highAccuracy?: boolean;
  minUpdateM?: number;
}) {
  const [position, setPosition] = useState<DevicePosition | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return watchDevicePosition(setPosition, {
      pauseWhenHidden: true,
      highAccuracy,
      minUpdateM,
      maximumAge: highAccuracy ? 2_000 : 8_000,
    });
  }, [enabled, highAccuracy, minUpdateM]);

  if (!position || !isUsableCoord(position.latitude, position.longitude)) return null;

  return <AgentLocationMarker position={position} />;
}
