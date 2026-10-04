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

export function versAdressesTrouvees(features: readonly BanFeature[]): AdresseTrouvee[] {
  return features.map((f) => ({
    id: f.properties.id ?? f.geometry.coordinates.join(','),
    label: rueSeule(f.properties.label, f.properties.postcode, f.properties.city),
    contexte: [f.properties.postcode, f.properties.city].filter(Boolean).join(' ') || null,
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    banId: f.properties.id ?? null,
  }));
}
