export type LngLatBoundsTuple = [[number, number], [number, number]];

/** Bounding box [[west, south], [east, north]] pour fitBounds Mapbox. */
export function computeLngLatBounds(
  points: readonly { latitude: number; longitude: number }[],
): LngLatBoundsTuple | null {
  if (points.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const point of points) {
    if (point.longitude < minLng) minLng = point.longitude;
    if (point.longitude > maxLng) maxLng = point.longitude;
    if (point.latitude < minLat) minLat = point.latitude;
    if (point.latitude > maxLat) maxLat = point.latitude;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
