/**
 * Cartes statiques IGN Géoplateforme (WMS). Aucune géométrie en base :
 * le bbox est calculé à l'affichage depuis lat/lng.
 */

export const ATTRIBUTION_IGN = '© IGN — Géoplateforme';

const WMS = 'https://data.geopf.fr/wms-r/wms';

export type CoucheIgn = 'plan' | 'cadastre';

const COUCHES: Record<CoucheIgn, string> = {
  plan: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
  cadastre: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS',
};

function mercator(lng: number, lat: number): { x: number; y: number } {
  const x = (lng * 20037508.34) / 180;
  const y =
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) * (20037508.34 / 180);
  return { x, y };
}

export function bboxMercator(
  lng: number,
  lat: number,
  spanM: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const c = mercator(lng, lat);
  const half = spanM / 2;
  return { minX: c.x - half, minY: c.y - half, maxX: c.x + half, maxY: c.y + half };
}

export function urlCarteIgn(input: {
  latitude: number;
  longitude: number;
  spanM?: number;
  width?: number;
  height?: number;
  couche?: CoucheIgn;
}): string {
  const span = input.spanM ?? 800;
  const w = input.width ?? 800;
  const h = input.height ?? 420;
  const box = bboxMercator(input.longitude, input.latitude, span);
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: COUCHES[input.couche ?? 'plan'],
    STYLES: '',
    CRS: 'EPSG:3857',
    BBOX: `${box.minX},${box.minY},${box.maxX},${box.maxY}`,
    WIDTH: String(w),
    HEIGHT: String(h),
    FORMAT: 'image/png',
    DPI: '96',
  });
  return `${WMS}?${params.toString()}`;
}

/** Position relative 0–1 dans le bbox, pour superposer une pastille. */
export function positionDansCarte(
  lat: number,
  lng: number,
  centre: { latitude: number; longitude: number },
  spanM: number,
): { x: number; y: number } | null {
  const box = bboxMercator(centre.longitude, centre.latitude, spanM);
  const p = mercator(lng, lat);
  const x = (p.x - box.minX) / (box.maxX - box.minX);
  const y = 1 - (p.y - box.minY) / (box.maxY - box.minY);
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y };
}
