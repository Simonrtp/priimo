import type { BanFeature } from '@/lib/ban';

/** Une adresse proposée pendant la frappe, prête à poser sur la carte. */
export type AdresseTrouvee = {
  id: string;
  /** « 148 Rue de Belleville » : la rue seule, la ville vient dessous. */
  label: string;
  /** « 75020 Paris ». */
  contexte: string | null;
  latitude: number;
  longitude: number;
  banId: string | null;
};

/** « 148 Rue de Belleville 75020 Paris » → « 148 Rue de Belleville ». */
export function rueSeule(label: string, postcode?: string, city?: string): string {
  const fin = [postcode, city].filter(Boolean).join(' ');
  return fin && label.endsWith(fin) ? label.slice(0, -fin.length).trim() || label : label;
}

/** Numéro en tête de saisie (« 27 rue… », « 27B avenue… »). */
export function numeroDansTexte(texte: string): string | null {
  const m = /^\s*(\d+[a-zA-Z]?)\b/u.exec(texte.trim());
  return m?.[1]?.toLowerCase() ?? null;
}

/**
 * Si la requête commence par un numéro, les housenumbers qui matchent
 * passent en tête — Entrée ne doit pas ouvrir le 29 quand on a tapé 27.
 */
export function prioriserNumeroExact(
  features: readonly BanFeature[],
  query: string,
): BanFeature[] {
  const n = numeroDansTexte(query);
  if (!n || features.length < 2) return [...features];
  return [...features].sort((a, b) => {
    const aMatch = numeroDansTexte(a.properties.label) === n ? 0 : 1;
    const bMatch = numeroDansTexte(b.properties.label) === n ? 0 : 1;
    return aMatch - bMatch;
  });
}

export function versAdressesTrouvees(
  features: readonly BanFeature[],
  query?: string,
): AdresseTrouvee[] {
  const ranked = query ? prioriserNumeroExact(features, query) : features;
  return ranked.map((f) => ({
    id: f.properties.id ?? f.geometry.coordinates.join(','),
    label: rueSeule(f.properties.label, f.properties.postcode, f.properties.city),
    contexte: [f.properties.postcode, f.properties.city].filter(Boolean).join(' ') || null,
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    banId: f.properties.id ?? null,
  }));
}
