/**
 * Décale la carte pour qu’un point reste dans la zone libre quand le volet
 * parcelle occupe la droite (desktop) ou le bas (mobile).
 */

type MapLike = {
  getCanvas: () => HTMLCanvasElement;
  project: (lngLat: [number, number]) => { x: number; y: number };
  unproject: (point: [number, number]) => { lng: number; lat: number };
  getCenter: () => { lng: number; lat: number };
  easeTo: (opts: {
    center: [number, number];
    duration?: number;
    essential?: boolean;
    padding?: { top: number; right: number; bottom: number; left: number };
  }) => void;
};

/** Largeur max du volet parcelle (alignée sur `md:max-w-[min(100%,500px)]`). */
export const VOLET_PARCELLE_MAX_PX = 500;
const MARGE = 28;
const DUREE_MS = 480;

export type PaddingCarte = { top: number; right: number; bottom: number; left: number };

/** Zone libre autour du volet — desktop à droite, mobile en bas (si volet non plein écran). */
export function paddingPourVoletParcelle(largeurCarte: number, hauteurCarte: number): PaddingCarte {
  const desktop =
    typeof globalThis !== 'undefined' &&
    typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia('(min-width: 768px)').matches;
  if (desktop) {
    const volet = Math.min(VOLET_PARCELLE_MAX_PX, Math.max(0, largeurCarte - 160));
    return { top: MARGE, right: volet + MARGE, bottom: MARGE, left: MARGE };
  }
  // Mobile : feuille basse (~72 % hauteur) — la parcelle reste dans la bande haute.
  const volet = Math.round(hauteurCarte * 0.72);
  return { top: MARGE, right: MARGE, bottom: volet + MARGE, left: MARGE };
}

function resoudreMap(map: MapLike | { getMap?: () => MapLike } | null | undefined): MapLike | null {
  if (!map) return null;
  if (typeof (map as MapLike).project === 'function' && typeof (map as MapLike).easeTo === 'function') {
    return map as MapLike;
  }
  const via = typeof (map as { getMap?: () => MapLike }).getMap === 'function'
    ? (map as { getMap: () => MapLike }).getMap()
    : null;
  return via && typeof via.project === 'function' ? via : null;
}

/**
 * Si le point est hors de la zone libre, décale la carte (pan).
 * Ne change pas le zoom.
 */
export function assurerPointVisible(
  mapInput: MapLike | { getMap?: () => MapLike } | null | undefined,
  point: { longitude: number; latitude: number } | null | undefined,
): void {
  const map = resoudreMap(mapInput);
  if (!map || !point) return;
  if (!Number.isFinite(point.longitude) || !Number.isFinite(point.latitude)) return;

  const canvas = map.getCanvas();
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 80 || h < 80) return;

  const pad = paddingPourVoletParcelle(w, h);
  const { x, y } = map.project([point.longitude, point.latitude]);

  const minX = pad.left;
  const maxX = w - pad.right;
  const minY = pad.top;
  const maxY = h - pad.bottom;

  // Zone libre trop étroite : on centre dans le padding Mapbox.
  if (maxX - minX < 80 || maxY - minY < 80) {
    map.easeTo({
      center: [point.longitude, point.latitude],
      padding: pad,
      duration: DUREE_MS,
      essential: true,
    });
    return;
  }

  let dx = 0;
  let dy = 0;
  if (x < minX) dx = x - minX;
  else if (x > maxX) dx = x - maxX;
  if (y < minY) dy = y - minY;
  else if (y > maxY) dy = y - maxY;

  if (dx === 0 && dy === 0) return;

  const c = map.project([map.getCenter().lng, map.getCenter().lat]);
  const next = map.unproject([c.x + dx, c.y + dy]);
  map.easeTo({
    center: [next.lng, next.lat],
    duration: DUREE_MS,
    essential: true,
  });
}
