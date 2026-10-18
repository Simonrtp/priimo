/**
 * Services à proximité, OpenStreetMap.
 *
 * Note d’une catégorie, sur le plus proche des 5 retenus, dans un rayon de 1 200 m :
 *   ≤ 200 m → 5
 *   ≤ 400 m → 4
 *   ≤ 700 m → 3
 *   ≤ 1 000 m → 2
 *   au-delà → 1
 * Aucun lieu : pas de note (la ligne dit « non disponible »).
 */

export const RAYON_SERVICES_M = 1200;
export const SERVICES_PAR_CATEGORIE = 5;

export const CATEGORIES_SERVICE = [
  { id: 'commerces', libelle: 'Commerces' },
  { id: 'education', libelle: 'Éducation' },
  { id: 'loisirs', libelle: 'Loisirs' },
  { id: 'restaurants', libelle: 'Restaurants' },
  { id: 'sante', libelle: 'Santé' },
] as const;

export type CategorieServiceId = (typeof CATEGORIES_SERVICE)[number]['id'];

export type LieuService = {
  nom: string;
  distanceM: number;
  latitude: number;
  longitude: number;
};

export type GroupeService = {
  id: CategorieServiceId;
  libelle: string;
  lieux: LieuService[];
  note: number | null;
};

export type ServicesProximite = {
  groupes: GroupeService[];
  attribution: '© OpenStreetMap';
};

type ElementOsm = {
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
};

const cache = new Map<string, ServicesProximite | null>();

export function noteProximite(distanceM: number | null): number | null {
  if (distanceM == null || !Number.isFinite(distanceM)) return null;
  if (distanceM <= 200) return 5;
  if (distanceM <= 400) return 4;
  if (distanceM <= 700) return 3;
  if (distanceM <= 1000) return 2;
  return 1;
}

export function classerElement(tags: Record<string, string> | undefined): CategorieServiceId | null {
  if (!tags) return null;
  const amenity = tags.amenity ?? '';
  const shop = tags.shop ?? '';
  const leisure = tags.leisure ?? '';
  if (shop) return 'commerces';
  if (/^(school|kindergarten|college|university)$/.test(amenity)) return 'education';
  if (leisure && leisure !== 'yes') return 'loisirs';
  if (/^(restaurant|cafe|fast_food|bar)$/.test(amenity)) return 'restaurants';
  if (/^(pharmacy|doctors|clinic|hospital|dentist)$/.test(amenity)) return 'sante';
  return null;
}

export function assemblerServices(
  elements: readonly ElementOsm[],
  origine: { latitude: number; longitude: number },
): ServicesProximite {
  const seaux = new Map<CategorieServiceId, LieuService[]>();
  for (const el of elements) {
    if (el.lat == null || el.lon == null) continue;
    const cat = classerElement(el.tags);
    if (!cat) continue;
    const nom = el.tags?.name?.trim() || el.tags?.brand?.trim();
    if (!nom) continue;
    const distanceM = Math.round(haversine(origine.latitude, origine.longitude, el.lat, el.lon));
    if (distanceM > RAYON_SERVICES_M) continue;
    const liste = seaux.get(cat) ?? [];
    liste.push({ nom, distanceM, latitude: el.lat, longitude: el.lon });
    seaux.set(cat, liste);
  }
  const groupes = CATEGORIES_SERVICE.map((c) => {
    const lieux = (seaux.get(c.id) ?? [])
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, SERVICES_PAR_CATEGORIE);
    return {
      id: c.id,
      libelle: c.libelle,
      lieux,
      note: noteProximite(lieux[0]?.distanceM ?? null),
    };
  });
  return { groupes, attribution: '© OpenStreetMap' };
}

export function servicesUtiles(s: ServicesProximite | null): boolean {
  return Boolean(s?.groupes.some((g) => g.lieux.length > 0));
}

export async function chargerServicesOsm(input: {
  latitude: number;
  longitude: number;
  /** Cache persistant par zone (3 décimales). L’échec de lecture n’invente rien. */
  lireCache?: (cle: string) => Promise<ServicesProximite | null>;
  ecrireCache?: (cle: string, services: ServicesProximite) => Promise<void>;
}): Promise<ServicesProximite | null> {
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) return null;
  const cle = `${input.latitude.toFixed(3)}:${input.longitude.toFixed(3)}`;
  if (cache.has(cle)) return cache.get(cle) ?? null;
  const persiste = input.lireCache ? await input.lireCache(cle).catch(() => null) : null;
  if (persiste && servicesUtiles(persiste)) {
    cache.set(cle, persiste);
    return persiste;
  }
  const q = `[out:json][timeout:12];(node["shop"](around:${RAYON_SERVICES_M},${input.latitude},${input.longitude});node["amenity"~"school|kindergarten|college|university|restaurant|cafe|fast_food|bar|pharmacy|doctors|clinic|hospital|dentist"](around:${RAYON_SERVICES_M},${input.latitude},${input.longitude});node["leisure"](around:${RAYON_SERVICES_M},${input.latitude},${input.longitude}););out body 120;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(q)}`,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { elements?: ElementOsm[] };
    const services = assemblerServices(json.elements ?? [], input);
    const resultat = servicesUtiles(services) ? services : null;
    if (resultat) {
      cache.set(cle, resultat);
      if (input.ecrireCache) await input.ecrireCache(cle, resultat).catch(() => undefined);
    }
    return resultat;
  } catch {
    return null;
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}
