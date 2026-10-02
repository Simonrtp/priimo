/**
 * Quelle parcelle contient ce point ? Sert à rattacher une adresse BAN à sa
 * parcelle quand la Base Adresse Nationale ne donne pas le lien cadastral
 * (au Mans, aucune des 44 000 adresses ne le porte).
 *
 * Géométrie GeoJSON en longitude/latitude. Pur, sans dépendance : le script
 * d'indexation le fait tourner sur des communes entières.
 */

type Position = readonly number[];
type Anneau = readonly Position[];

export type ParcelleGeo = {
  id: string;
  /** Anneaux extérieurs puis trous, par polygone. */
  polygones: readonly (readonly Anneau[])[];
  bbox: readonly [number, number, number, number];
};

/** Lecture tolérante d'une géométrie GeoJSON Polygon / MultiPolygon. */
export function lireParcelle(id: string, geometry: unknown): ParcelleGeo | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as { type?: string; coordinates?: unknown };
  const polygones =
    g.type === 'Polygon'
      ? [g.coordinates as Anneau[]]
      : g.type === 'MultiPolygon'
        ? (g.coordinates as Anneau[][])
        : null;
  if (!polygones || polygones.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polygones) {
    for (const [x, y] of poly[0] ?? []) {
      if (x === undefined || y === undefined) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { id, polygones, bbox: [minX, minY, maxX, maxY] };
}

/** Lancer de rayon classique : nombre impair de croisements = dedans. */
function dansAnneau(x: number, y: number, anneau: Anneau): boolean {
  let dedans = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const xi = anneau[i]![0]!;
    const yi = anneau[i]![1]!;
    const xj = anneau[j]![0]!;
    const yj = anneau[j]![1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

export function parcelleContient(parcelle: ParcelleGeo, lon: number, lat: number): boolean {
  const [minX, minY, maxX, maxY] = parcelle.bbox;
  if (lon < minX || lon > maxX || lat < minY || lat > maxY) return false;
  for (const [exterieur, ...trous] of parcelle.polygones) {
    if (!exterieur || !dansAnneau(lon, lat, exterieur)) continue;
    if (trous.some((trou) => dansAnneau(lon, lat, trou))) continue;
    return true;
  }
  return false;
}

/** Cellules d'environ 200 m : une commune entière se parcourt en quelques millisecondes. */
const PAS = 0.002;

export type IndexParcelles = {
  trouver: (lon: number, lat: number) => string | null;
  /** Nombre de parcelles indexées : 0 quand la commune n'a pas de cadastre. */
  taille: number;
};

export function indexerParcelles(parcelles: readonly ParcelleGeo[]): IndexParcelles {
  const grille = new Map<string, ParcelleGeo[]>();
  for (const p of parcelles) {
    const [minX, minY, maxX, maxY] = p.bbox;
    for (let cx = Math.floor(minX / PAS); cx <= Math.floor(maxX / PAS); cx += 1) {
      for (let cy = Math.floor(minY / PAS); cy <= Math.floor(maxY / PAS); cy += 1) {
        const cle = `${cx}:${cy}`;
        const liste = grille.get(cle);
        if (liste) liste.push(p);
        else grille.set(cle, [p]);
      }
    }
  }
  return {
    taille: parcelles.length,
    trouver(lon, lat) {
      const candidates = grille.get(`${Math.floor(lon / PAS)}:${Math.floor(lat / PAS)}`) ?? [];
      return candidates.find((p) => parcelleContient(p, lon, lat))?.id ?? null;
    },
  };
}
