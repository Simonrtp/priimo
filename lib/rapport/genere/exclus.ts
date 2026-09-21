export type RapportExclus = {
  comparables: string[];
  annonces: string[];
};

export function parseRapportExclus(raw: unknown): RapportExclus {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    comparables: listeIds(o.comparables),
    annonces: listeIds(o.annonces),
  };
}

function listeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim());
}

export function basculerExclusion(liste: readonly string[], id: string): string[] {
  return liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];
}
