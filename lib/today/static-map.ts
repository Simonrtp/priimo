import type { LocatedTask } from './tournee';
import { computeLngLatBounds } from '@/lib/carte/bounds';
import {
  boundsCenter,
  routeBearing,
  STATIC_MAP_PITCH,
  staticPreviewZoom,
} from '@/lib/map/camera';
import { PRIIMO_MAP_STYLE } from '@/lib/map/style';

const STYLE_ID = PRIIMO_MAP_STYLE.replace('mapbox://styles/', '');
const ORANGE = 'E8743C';

function expandBounds(
  bounds: [[number, number], [number, number]],
  padDeg = 0.0007,
): [[number, number], [number, number]] {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  if (minLng === maxLng && minLat === maxLat) {
    return [
      [minLng - padDeg, minLat - padDeg],
      [maxLng + padDeg, maxLat + padDeg],
    ];
  }
  return [
    [minLng - padDeg, minLat - padDeg],
    [maxLng + padDeg, maxLat + padDeg],
  ];
}

/**
 * Image Mapbox Static inclinée — pas de carte interactive.
 * Retourne null si le jeton manque ou s’il n’y a pas de points.
 */
export function staticTourneeUrl(
  stops: readonly LocatedTask[],
  width = 680,
  height = 200,
): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || stops.length === 0) return null;

  const rawBounds = computeLngLatBounds(stops);
  if (!rawBounds) return null;
  const bounds = expandBounds(rawBounds);
  const center = boundsCenter(bounds);
  const bearing = routeBearing(stops);
  const zoom = staticPreviewZoom(bounds, width, height);

  // Mapbox exige des paires lng,lat séparées par des point-virgules.
  const pathCoords = stops.map((s) => `${s.longitude},${s.latitude}`).join(';');
  const overlays = [
    encodeURIComponent(`path-5+${ORANGE}-0.95(${pathCoords})`),
    ...stops.map((s, i) =>
      encodeURIComponent(`pin-s-${i + 1}+${ORANGE}(${s.longitude},${s.latitude})`),
    ),
  ].join(',');

  const camera = `${center.longitude},${center.latitude},${zoom.toFixed(2)},${bearing.toFixed(1)},${STATIC_MAP_PITCH}`;

  return `https://api.mapbox.com/styles/v1/${STYLE_ID}/static/${overlays}/${camera}/${width}x${height}@2x?access_token=${token}`;
}
