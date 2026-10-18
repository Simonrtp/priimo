import { ATTRIBUTION_MAPBOX, urlCarteMapbox } from '@/lib/rapport/genere/carte-mapbox';

/** Marche, vélo, voiture. Pas de transports en commun. */
export const PROFILS_ISOCHRONE = [
  { id: 'walking', libelle: 'À pied' },
  { id: 'cycling', libelle: 'À vélo' },
  { id: 'driving', libelle: 'En voiture' },
] as const;

export type ProfilIsochrone = (typeof PROFILS_ISOCHRONE)[number]['id'];

export type ZoneIsochrone = {
  profil: ProfilIsochrone;
  libelle: string;
  minutes: number[];
};

export type Accessibilite = {
  zones: ZoneIsochrone[];
  carteUrl: string | null;
  attribution: string;
};

const MINUTES = [10, 20];

/**
 * Polygones Mapbox Isochrone, calculés à la volée. L’image n’est pas stockée.
 * Pas de Street View. Pas de transports en commun.
 */
export async function chargerAccessibilite(input: {
  latitude: number;
  longitude: number;
}): Promise<Accessibilite | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) return null;
  const zones: ZoneIsochrone[] = [];
  for (const profil of PROFILS_ISOCHRONE) {
    const ok = await profilDisponible(profil.id, input, token);
    if (ok) zones.push({ profil: profil.id, libelle: profil.libelle, minutes: MINUTES });
  }
  if (zones.length === 0) return null;
  return {
    zones,
    carteUrl: urlCarteMapbox({
      latitude: input.latitude,
      longitude: input.longitude,
      zoom: 13,
      width: 800,
      height: 480,
    }),
    attribution: ATTRIBUTION_MAPBOX,
  };
}

async function profilDisponible(
  profil: ProfilIsochrone,
  input: { latitude: number; longitude: number },
  token: string,
): Promise<boolean> {
  const url = new URL(
    `https://api.mapbox.com/isochrone/v1/mapbox/${profil}/${input.longitude},${input.latitude}`,
  );
  url.searchParams.set('contours_minutes', MINUTES.join(','));
  url.searchParams.set('polygons', 'true');
  url.searchParams.set('access_token', token);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return false;
    const json = (await res.json()) as { features?: unknown[] };
    return Array.isArray(json.features) && json.features.length > 0;
  } catch {
    return false;
  }
}
