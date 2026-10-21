import { PRIIMO_MAP_STYLE } from '@/lib/map/style';

const STYLE_ID = PRIIMO_MAP_STYLE.replace('mapbox://styles/', '');

export const ATTRIBUTION_MAPBOX = '© Mapbox © OpenStreetMap';
export const MENTION_CADASTRE = 'Plan cadastral indicatif, sans valeur juridique.';

/**
 * Image Mapbox Static à la volée. Jamais stockée.
 * Pas de Street View.
 */
export function urlCarteMapbox(input: {
  latitude: number;
  longitude: number;
  zoom?: number;
  width?: number;
  height?: number;
  pins?: ReadonlyArray<{ lat: number; lng: number; label?: string }>;
}): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const w = Math.min(1280, input.width ?? 800);
  const h = Math.min(1280, input.height ?? 420);
  const zoom = input.zoom ?? 16;
  const pins = (input.pins ?? [{ lat: input.latitude, lng: input.longitude }])
    .slice(0, 12)
    .map((p, i) => {
      const label = p.label ?? String(i + 1);
      return encodeURIComponent(`pin-s-${label}+E8743C(${p.lng},${p.lat})`);
    })
    .join(',');
  const camera = `${input.longitude},${input.latitude},${zoom}`;
  const overlay = pins || encodeURIComponent(`pin-s+E8743C(${input.longitude},${input.latitude})`);
  return `https://api.mapbox.com/styles/v1/${STYLE_ID}/static/${overlay}/${camera}/${w}x${h}@2x?access_token=${token}`;
}
