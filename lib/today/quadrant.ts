import type { GeoCoord } from '@/lib/carte/coords';
import { toGeoCoord } from '@/lib/carte/coords';
import { bearingDegrees, cardinalFrom } from './field';

export function centroidFromCoords(
  items: readonly { latitude: number | null | undefined; longitude: number | null | undefined }[],
): GeoCoord | null {
  const pts = items
    .map((i) => toGeoCoord(i.latitude, i.longitude))
    .filter((p): p is GeoCoord => p !== null);
  if (pts.length === 0) return null;
  return {
    latitude: pts.reduce((s, p) => s + p.latitude, 0) / pts.length,
    longitude: pts.reduce((s, p) => s + p.longitude, 0) / pts.length,
  };
}

/** Libellé quadrant relatif au centre du secteur agence. */
export function tourneeQuadrantLabel(
  stops: readonly { latitude: number; longitude: number }[],
  sectorRef: GeoCoord | null,
): string | null {
  if (!sectorRef || stops.length === 0) return null;
  const tourCenter = centroidFromCoords(stops);
  if (!tourCenter) return null;

  const distM =
    Math.abs(tourCenter.latitude - sectorRef.latitude) +
    Math.abs(tourCenter.longitude - sectorRef.longitude);
  if (distM < 0.00015) return 'Zone secteur';

  const bearing = bearingDegrees(sectorRef, tourCenter);
  const cardinal = cardinalFrom(bearing);
  return `Zone ${cardinal}`;
}

export function tourneeTitle({
  stopCount,
  quadrantLabel,
}: {
  stopCount: number;
  quadrantLabel: string | null;
}): string {
  if (quadrantLabel) return `Tournée · ${quadrantLabel} · aujourd’hui`;
  const n = stopCount;
  return `Tournée · ${n} adresse${n > 1 ? 's' : ''}`;
}
