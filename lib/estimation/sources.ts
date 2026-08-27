/**
 * Sources d'une estimation — catalogue fixe + filtrage sur celles
 * réellement mobilisées par le moteur pour CETTE estimation.
 */

export const ESTIMATION_SOURCE_IDS = [
  'dvf',
  'notaires_insee',
  'cadastre',
  'dpe',
  'copro',
  'bienici',
] as const;

export type EstimationSourceId = (typeof ESTIMATION_SOURCE_IDS)[number];

export type EstimationSourceMeta = {
  id: EstimationSourceId;
  title: string;
  subtitle: string;
};

/** Six entrées fixes — texte seul, aucun logo institutionnel. */
export const ESTIMATION_SOURCE_CATALOG: readonly EstimationSourceMeta[] = [
  {
    id: 'dvf',
    title: 'DVF · Etalab',
    subtitle: 'Ventes réelles actées chez le notaire, 5 dernières années',
  },
  {
    id: 'notaires_insee',
    title: 'Indice Notaires · INSEE',
    subtitle: 'Réactualisation trimestrielle des prix',
  },
  {
    id: 'cadastre',
    title: 'Cadastre · IGN',
    subtitle: 'Parcelle et rattachement exact du bien',
  },
  {
    id: 'dpe',
    title: 'DPE · ADEME',
    subtitle: 'Diagnostics et étiquettes énergétiques',
  },
  {
    id: 'copro',
    title: 'Copropriétés · RNC',
    subtitle: 'Registre national, lots et procédures',
  },
  {
    id: 'bienici',
    title: "Marché actuel · Bien'ici",
    subtitle: "Biens en vente dans le secteur aujourd'hui",
  },
] as const;

const CATALOG_BY_ID = new Map(ESTIMATION_SOURCE_CATALOG.map((s) => [s.id, s]));

export function isEstimationSourceId(value: unknown): value is EstimationSourceId {
  return typeof value === 'string' && (ESTIMATION_SOURCE_IDS as readonly string[]).includes(value);
}

/** Garde l'ordre du catalogue ; ignore les ids inconnus. */
export function normalizeEstimationSources(raw: unknown): EstimationSourceId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<EstimationSourceId>();
  for (const item of raw) {
    if (isEstimationSourceId(item)) seen.add(item);
  }
  return ESTIMATION_SOURCE_IDS.filter((id) => seen.has(id));
}

export function sourcesFromContext(context: unknown): EstimationSourceId[] {
  if (!context || typeof context !== 'object') return [];
  const sources = (context as { sources?: unknown }).sources;
  return normalizeEstimationSources(sources);
}

export function estimationSourceMeta(id: EstimationSourceId): EstimationSourceMeta {
  return CATALOG_BY_ID.get(id)!;
}

export function resolveEstimationSources(
  ids: readonly EstimationSourceId[],
): EstimationSourceMeta[] {
  return normalizeEstimationSources(ids).map(estimationSourceMeta);
}

export const ESTIMATION_SOURCES_DISCLAIMER =
  'Sources publiques croisées par Priimo — sans caution de ces institutions.';

