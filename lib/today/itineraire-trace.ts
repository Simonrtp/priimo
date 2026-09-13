import { haversineM } from '@/lib/geo/distance';
import type { GeoCoord } from '@/lib/carte/coords';
import type { LngLat } from '@/lib/today/simplify-line';
import { pointToSegmentM } from '@/lib/today/simplify-line';

export type TracePoint = { latitude: number; longitude: number };

function asCoord(p: LngLat): GeoCoord {
  return { longitude: p[0] ?? 0, latitude: p[1] ?? 0 };
}

function toLngLat(p: TracePoint): LngLat {
  return [p.longitude, p.latitude];
}

function segmentLengthM(a: LngLat, b: LngLat): number {
  return haversineM(asCoord(a), asCoord(b));
}

export function lineLengthM(coords: readonly LngLat[]): number {
  let n = 0;
  for (let i = 1; i < coords.length; i++) n += segmentLengthM(coords[i - 1]!, coords[i]!);
  return n;
}

/**
 * Projection du point sur la polyligne : fraction 0–1 depuis le départ,
 * et le sommet interpolé.
 */
export function projectOnLine(
  coords: readonly LngLat[],
  point: TracePoint,
): { fraction: number; coord: LngLat } | null {
  if (coords.length < 2) return null;
  const p = toLngLat(point);
  let bestD = Infinity;
  let bestSeg = 0;
  let bestT = 0;
  let prefix = 0;
  const segLens: number[] = [];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    const len = segmentLengthM(a, b);
    segLens.push(len);
    const d = pointToSegmentM(p, a, b);
    if (d < bestD) {
      bestD = d;
      bestSeg = i - 1;
      const lat0 = (((a[1] ?? 0) + (b[1] ?? 0)) / 2) * (Math.PI / 180);
      const mx = 111_320 * Math.cos(lat0);
      const my = 110_540;
      const dx = ((b[0] ?? 0) - (a[0] ?? 0)) * mx;
      const dy = ((b[1] ?? 0) - (a[1] ?? 0)) * my;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-6) {
        bestT = 0;
      } else {
        const t =
          (((p[0] ?? 0) - (a[0] ?? 0)) * mx * dx + ((p[1] ?? 0) - (a[1] ?? 0)) * my * dy) / len2;
        bestT = Math.max(0, Math.min(1, t));
      }
    }
    prefix += len;
  }
  const total = prefix || 1;
  let before = 0;
  for (let i = 0; i < bestSeg; i++) before += segLens[i] ?? 0;
  const frac = (before + (segLens[bestSeg] ?? 0) * bestT) / total;
  const a = coords[bestSeg]!;
  const b = coords[bestSeg + 1]!;
  return {
    fraction: Math.max(0, Math.min(1, frac)),
    coord: [
      (a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * bestT,
      (a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * bestT,
    ],
  };
}

export function stopFraction(coords: readonly LngLat[], stop: TracePoint): number {
  return projectOnLine(coords, stop)?.fraction ?? 0;
}

/** Mètres / pixel Web Mercator à cette latitude et ce zoom. */
export function metersPerPixel(latitude: number, zoom: number): number {
  return (156_543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

/**
 * Décale les pastilles qui se recouvrent. Offsets en pixels (Marker.offset).
 */
export function stopPixelOffsets(
  stops: readonly TracePoint[],
  zoom: number,
  minPx = 24,
): [number, number][] {
  const n = stops.length;
  const offsets: [number, number][] = stops.map(() => [0, 0]);
  if (n < 2) return offsets;
  const origin = stops[0]!;
  const mPerPx = Math.max(0.2, metersPerPixel(origin.latitude, zoom));
  const mx = 111_320 * Math.cos((origin.latitude * Math.PI) / 180);
  const my = 110_540;

  const pos = stops.map((s) => ({
    x: ((s.longitude - origin.longitude) * mx) / mPerPx,
    y: (-(s.latitude - origin.latitude) * my) / mPerPx,
  }));

  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[j]!.x + offsets[j]![0] - (pos[i]!.x + offsets[i]![0]);
        let dy = pos[j]!.y + offsets[j]![1] - (pos[i]!.y + offsets[i]![1]);
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          dx = 1;
          dy = 0;
          dist = 0.01;
        }
        if (dist >= minPx) continue;
        const push = (minPx - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        offsets[i]![0] -= nx * push;
        offsets[i]![1] -= ny * push;
        offsets[j]![0] += nx * push;
        offsets[j]![1] += ny * push;
      }
    }
  }
  return offsets;
}
