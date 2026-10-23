/**
 * SeLoger floute l'emplacement du bien sur sa carte (un quartier), mais publie
 * les écoles voisines avec leur distance. Pour les écoles privées, c'est la
 * distance à vol d'oiseau depuis le vrai logement (les écoles publiques donnent
 * un trajet à pied) : 382 m publiés, 381 m mesurés depuis le 73 bd Richard
 * Lenoir. Placées grâce à l'annuaire de l'Éducation nationale (public, sans
 * clé), quatre écoles ou plus retrouvent l'immeuble à quelques mètres près :
 * 1 m, 1 m, 15 m et 25 m sur quatre annonces à l'adresse connue (23/10/2026).
 */
import type { FicheAnnonce } from './types';

export type EcoleProche = { nom: string; distanceM: number };
type Position = { latitude: number; longitude: number };
type Zone = NonNullable<FicheAnnonce['zone']>;
type Fetcher = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const ANNUAIRE = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records';

/** Une école est « concordante » si sa distance publiée tombe à 30 m près. */
const TOLERANCE_M = 30;
/** Il en faut quatre, avec un écart moyen de quelques mètres : trois cercles se croisent presque toujours. */
const ECOLES_MIN = 4;
const ECART_MOYEN_MAX_M = 8;
/** L'erreur constatée (numéros voisins dans la BAN) : le rayon du point retrouvé. */
export const RAYON_ECOLES_M = 35;

const GENERIQUES = new Set([
  'ecole', 'maternelle', 'elementaire', 'primaire', 'privee', 'prive', 'publique', 'college', 'lycee',
  'generale', 'general', 'technologique', 'professionnel', 'secondaire', 'application', 'paris',
  'rue', 'passage', 'avenue', 'boulevard', 'place', 'des', 'les', 'del', 'aux',
]);

/** « École Élémentaire Privée Charles Peguy » → ['Charles', 'Peguy'] : ce que l'annuaire cherche. */
export function motsCles(nom: string): string[] {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((m) => m.length > 2 && !GENERIQUES.has(m.toLowerCase()) && !/^\d+$/.test(m))
    .slice(0, 3);
}

/** Les écoles privées de la fiche SeLoger (« 283 m », « 1.5 km »). */
export function ecolesSeLoger(location: unknown): EcoleProche[] {
  const ecoles = ((location as { schools?: { privateSchools?: unknown } } | null)?.schools?.privateSchools ?? []) as Array<{ name?: unknown; distanceKm?: unknown }>;
  const out: EcoleProche[] = [];
  for (const e of Array.isArray(ecoles) ? ecoles : []) {
    const m = String(e.distanceKm ?? '').replace(',', '.').match(/([\d.]+)\s*(k?m)\b/i);
    if (typeof e.name !== 'string' || !m) continue;
    const distanceM = Number(m[1]) * (m[2]!.toLowerCase() === 'km' ? 1000 : 1);
    if (Number.isFinite(distanceM) && distanceM > 0 && distanceM < 3000) out.push({ nom: e.name, distanceM });
  }
  return out;
}

const fetcherParDefaut: Fetcher = (url) => fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(5_000) });

/** Les établissements de l'annuaire qui portent ce nom dans le département (plusieurs : on garde tout). */
async function positionsEcole(nom: string, departement: string, fetcher: Fetcher): Promise<Position[]> {
  const mots = motsCles(nom);
  if (!mots.length) return [];
  const where = `code_departement="${departement}" AND ` + mots.map((m) => `search(nom_etablissement, "${m}")`).join(' AND ');
  try {
    const res = await fetcher(`${ANNUAIRE}?where=${encodeURIComponent(where)}&limit=8&select=latitude,longitude`);
    if (!res.ok) return [];
    const body = (await res.json()) as { results?: Array<{ latitude?: unknown; longitude?: unknown }> };
    return (body.results ?? [])
      .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
      .map((r) => ({ latitude: r.latitude as number, longitude: r.longitude as number }));
  } catch {
    return [];
  }
}

function distanceM(a: Position, b: Position): number {
  const dx = (b.longitude - a.longitude) * 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  const dy = (b.latitude - a.latitude) * 110_540;
  return Math.hypot(dx, dy);
}

type Repere = { distanceM: number; positions: Position[] };

/** Note d'un point : d'abord le nombre d'écoles concordantes, puis leur écart moyen. Pur. */
function noter(p: Position, reperes: Repere[]): { concordantes: number; ecartMoyen: number; note: number } {
  let concordantes = 0;
  let somme = 0;
  for (const r of reperes) {
    const ecart = Math.min(...r.positions.map((q) => Math.abs(distanceM(p, q) - r.distanceM)));
    if (ecart <= TOLERANCE_M) {
      concordantes += 1;
      somme += ecart;
    }
  }
  const ecartMoyen = concordantes ? somme / concordantes : TOLERANCE_M;
  return { concordantes, ecartMoyen, note: (reperes.length - concordantes) * 1000 + ecartMoyen };
}

/**
 * Le point qui explique le plus de distances publiées, cherché autour du quartier
 * publié (une école mal identifiée peut être à l'autre bout de la ville). Pur.
 */
export function trianguler(reperes: Repere[], centre: Position, porteeM = 1500): (Position & { concordantes: number; ecartMoyen: number }) | null {
  const utiles = reperes.filter((r) => r.positions.length > 0);
  if (utiles.length < ECOLES_MIN) return null;
  const decaler = (p: Position, dx: number, dy: number): Position => ({
    latitude: p.latitude + dy / 110_540,
    longitude: p.longitude + dx / (111_320 * Math.cos((p.latitude * Math.PI) / 180)),
  });
  const grossier: Array<Position & { note: number }> = [];
  for (let dy = -porteeM; dy <= porteeM; dy += 15) {
    for (let dx = -porteeM; dx <= porteeM; dx += 15) {
      const p = decaler(centre, dx, dy);
      grossier.push({ ...p, note: noter(p, utiles).note });
    }
  }
  grossier.sort((a, b) => a.note - b.note);
  let meilleur: (Position & { concordantes: number; ecartMoyen: number; note: number }) | null = null;
  for (const depart of grossier.slice(0, 6)) {
    for (let dy = -30; dy <= 30; dy += 1.5) {
      for (let dx = -30; dx <= 30; dx += 1.5) {
        const p = decaler(depart, dx, dy);
        const n = noter(p, utiles);
        if (!meilleur || n.note < meilleur.note) meilleur = { ...p, ...n };
      }
    }
  }
  if (!meilleur || meilleur.concordantes < ECOLES_MIN || meilleur.ecartMoyen > ECART_MOYEN_MAX_M) return null;
  return { latitude: meilleur.latitude, longitude: meilleur.longitude, concordantes: meilleur.concordantes, ecartMoyen: meilleur.ecartMoyen };
}

/** L'emplacement du bien à quelques dizaines de mètres près, ou null si les écoles ne concordent pas. */
export async function situerParEcoles(ecoles: EcoleProche[], codePostal: string, repere: Zone, fetcher: Fetcher = fetcherParDefaut): Promise<Zone | null> {
  if (ecoles.length < ECOLES_MIN || !/^\d{5}$/.test(codePostal)) return null;
  const departement = codePostal.startsWith('97') ? codePostal.slice(0, 3) : codePostal.slice(0, 2).padStart(3, '0');
  const reperes = await Promise.all(ecoles.map(async (e) => ({ distanceM: e.distanceM, positions: await positionsEcole(e.nom, departement, fetcher) })));
  const point = trianguler(reperes, repere, Math.max(1500, repere.rayonM + 800));
  return point ? { latitude: point.latitude, longitude: point.longitude, rayonM: RAYON_ECOLES_M } : null;
}
