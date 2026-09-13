import { haversineM } from '@/lib/geo/distance';
import type { GeoCoord } from '@/lib/carte/coords';

export type LngLat = [number, number];

/** Largeur d'une rue urbaine : la tolérance ne doit jamais l'atteindre. */
const RUE_M = 8;
const TOLERANCE_MIN_M = 1;
const TOLERANCE_MAX_M = 4;

/**
 * Tolérance Douglas-Peucker selon le zoom. Assez pour le bruit des
 * micro-sommets, trop faible pour couper un coin de rue.
 */
export function simplifyToleranceM(zoom: number): number {
  const meters = 2.5 * 2 ** (15 - zoom);
  return Math.min(TOLERANCE_MAX_M, Math.max(TOLERANCE_MIN_M, meters), RUE_M - 2);
}

function asCoord(p: LngLat): GeoCoord {
  return { longitude: p[0] ?? 0, latitude: p[1] ?? 0 };
}

/** Distance du point à [a,b], en mètres (équirectangulaire local). */
export function pointToSegmentM(p: LngLat, a: LngLat, b: LngLat): number {
  const lat0 = (((a[1] ?? 0) + (b[1] ?? 0) + (p[1] ?? 0)) / 3) * (Math.PI / 180);
  const mx = 111_320 * Math.cos(lat0);
  const my = 110_540;
  const ax = (a[0] ?? 0) * mx;
  const ay = (a[1] ?? 0) * my;
  const bx = (b[0] ?? 0) * mx;
  const by = (b[1] ?? 0) * my;
  const px = (p[0] ?? 0) * mx;
  const py = (p[1] ?? 0) * my;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return haversineM(asCoord(p), asCoord(a));
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function douglasPeucker(points: readonly LngLat[], start: number, end: number, tolM: number, keep: boolean[]): void {
  if (end <= start + 1) return;
  let maxD = -1;
  let maxI = start;
  const a = points[start]!;
  const b = points[end]!;
  for (let i = start + 1; i < end; i++) {
    const d = pointToSegmentM(points[i]!, a, b);
    if (d > maxD) {
      maxD = d;
      maxI = i;
    }
  }
  if (maxD > tolM) {
    keep[maxI] = true;
    douglasPeucker(points, start, maxI, tolM, keep);
    douglasPeucker(points, maxI, end, tolM, keep);
  }
}

/** Retire le bruit, pas le trajet. */
export function simplifyLine(points: readonly LngLat[], toleranceM: number): LngLat[] {
  if (points.length <= 2) return points.map((p) => [p[0] ?? 0, p[1] ?? 0]);
  const keep = points.map((_, i) => i === 0 || i === points.length - 1);
  douglasPeucker(points, 0, points.length - 1, toleranceM, keep);
  const out: LngLat[] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) out.push([points[i]![0] ?? 0, points[i]![1] ?? 0]);
  }
  return out;
}

export function simplifyLineString(
  geometry: GeoJSON.LineString,
  zoom: number,
): GeoJSON.LineString {
  const coords = geometry.coordinates as LngLat[];
  return {
    type: 'LineString',
    coordinates: simplifyLine(coords, simplifyToleranceM(zoom)),
  };
}
