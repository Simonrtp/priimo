import { codeCommuneInsee } from '@/lib/rapport/code-commune';

export type TrancheAge = { libelle: string; part: number };
export type CategorieSocio = { libelle: string; part: number };
export type PointPopulation = { annee: number; population: number };

export type SocioCommune = {
  code: string;
  nom: string | null;
  population: number | null;
  serie: PointPopulation[];
  ages: TrancheAge[];
  csp: CategorieSocio[];
  tauxChomage: number | null;
  /** Millésime du recensement quand il est connu. */
  millesime: number | null;
};

const cache = new Map<string, SocioCommune | null>();

/**
 * Recensement INSEE à la commune. La population peut venir de l’API Géo
 * (population municipale INSEE). Âges, CSP et chômage restent vides tant que
 * la table `insee_communes` n’est pas chargée — jamais une valeur inventée.
 * Ce n’est pas l’indice Notaires–INSEE qui actualise les prix.
 */
export async function chargerSocioCommune(input: {
  parcelleId: string | null;
  postalCode: string | null;
  lireTable?: (code: string) => Promise<SocioCommune | null>;
}): Promise<SocioCommune | null> {
  const code = codeCommuneInsee(input);
  if (!code) return null;
  if (cache.has(code)) return cache.get(code) ?? null;
  const table = input.lireTable ? await input.lireTable(code).catch(() => null) : null;
  const geo = table?.population != null ? null : await populationGeo(code);
  const resultat = fusionner(table, geo);
  cache.set(code, resultat);
  return resultat;
}

function fusionner(table: SocioCommune | null, geo: SocioCommune | null): SocioCommune | null {
  if (!table && !geo) return null;
  const base = table ?? geo!;
  const autre = table && geo ? geo : null;
  const fusion: SocioCommune = {
    code: base.code,
    nom: base.nom ?? autre?.nom ?? null,
    population: base.population ?? autre?.population ?? null,
    serie: base.serie.length > 0 ? base.serie : (autre?.serie ?? []),
    ages: base.ages.length > 0 ? base.ages : (autre?.ages ?? []),
    csp: base.csp.length > 0 ? base.csp : (autre?.csp ?? []),
    tauxChomage: base.tauxChomage ?? autre?.tauxChomage ?? null,
    millesime: base.millesime ?? autre?.millesime ?? null,
  };
  return aDeLaMatiere(fusion) ? fusion : null;
}

function aDeLaMatiere(s: SocioCommune): boolean {
  return (
    (s.population != null && s.population > 0) ||
    s.serie.length > 0 ||
    s.ages.length > 0 ||
    s.csp.length > 0 ||
    s.tauxChomage != null
  );
}

async function populationGeo(code: string): Promise<SocioCommune | null> {
  try {
    const res = await fetch(
      `https://geo.api.gouv.fr/communes/${encodeURIComponent(code)}?fields=nom,code,population`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return null;
    const row = (await res.json()) as { nom?: string; code?: string; population?: number };
    const population =
      typeof row.population === 'number' && row.population > 0 ? Math.round(row.population) : null;
    if (population == null) return null;
    return {
      code,
      nom: typeof row.nom === 'string' ? row.nom : null,
      population,
      serie: [],
      ages: [],
      csp: [],
      tauxChomage: null,
      millesime: null,
    };
  } catch {
    return null;
  }
}

export function socioDepuisLigne(row: {
  code: string;
  nom?: string | null;
  population?: number | null;
  serie?: unknown;
  ages?: unknown;
  csp?: unknown;
  taux_chomage?: number | null;
  millesime?: number | null;
}): SocioCommune {
  return {
    code: row.code,
    nom: row.nom ?? null,
    population: nombre(row.population),
    serie: lireSerie(row.serie),
    ages: lireParts(row.ages),
    csp: lireParts(row.csp),
    tauxChomage: nombre(row.taux_chomage),
    millesime: nombre(row.millesime),
  };
}

function nombre(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function lireSerie(raw: unknown): PointPopulation[] {
  if (!Array.isArray(raw)) return [];
  const out: PointPopulation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const annee = nombre(o.annee);
    const population = nombre(o.population);
    if (annee == null || population == null || population <= 0) continue;
    out.push({ annee, population });
  }
  return out.sort((a, b) => a.annee - b.annee);
}

function lireParts(raw: unknown): Array<{ libelle: string; part: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ libelle: string; part: number }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const libelle = typeof o.libelle === 'string' ? o.libelle.trim() : '';
    const part = nombre(o.part);
    if (!libelle || part == null || part < 0) continue;
    out.push({ libelle, part });
  }
  return out;
}
