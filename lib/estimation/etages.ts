/** Valeurs stockées pour l'étage (alignées sur le funnel public). */
export const VALEURS_ETAGE = [
  'RDC',
  ...Array.from({ length: 19 }, (_, i) => String(i + 1)),
  '20+',
] as const;

export type ValeurEtage = (typeof VALEURS_ETAGE)[number];

export function libelleEtage(valeur: string): string {
  if (valeur === 'RDC') return 'Rez-de-chaussée';
  if (valeur === '20+') return '20e et plus';
  if (valeur === '1') return '1er étage';
  const n = Number.parseInt(valeur, 10);
  if (!Number.isNaN(n) && n >= 2) return `${n}e étage`;
  return valeur;
}

export function optionsEtage(selected: string | null): { value: string; label: string }[] {
  const courant = selected?.trim();
  const valeurs =
    courant && !VALEURS_ETAGE.includes(courant as ValeurEtage)
      ? [courant, ...VALEURS_ETAGE]
      : [...VALEURS_ETAGE];
  return [
    { value: '', label: 'Non renseigné' },
    ...valeurs.map((v) => ({ value: v, label: libelleEtage(v) })),
  ];
}

/** Nombre total d'étages du bâtiment. */
export const VALEURS_ETAGES_IMMEUBLE = [
  ...Array.from({ length: 24 }, (_, i) => i + 1),
  25,
] as const;

export type ValeurEtagesImmeuble = (typeof VALEURS_ETAGES_IMMEUBLE)[number];

export function libelleEtagesImmeuble(n: number): string {
  if (n === 1) return '1 étage';
  if (n === 25) return '25 étages et plus';
  return `${n} étages`;
}

/** RDC = 0. Null si l’étage n’est pas un nombre comparable. */
export function numeroEtage(floor: string | null | undefined): number | null {
  if (!floor) return null;
  const v = floor.trim();
  if (v === 'RDC') return 0;
  if (v === '20+') return 20;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * 2e étage / 3 étages → pas dernier. 3e / 3 → dernier.
 * Ne devine rien si l’un des deux manque.
 */
export function inferDernierEtage(
  floor: string | null | undefined,
  etagesImmeuble: number | null | undefined,
): boolean | null {
  const etage = numeroEtage(floor);
  if (etage == null || etagesImmeuble == null || etagesImmeuble <= 0) return null;
  return etage >= etagesImmeuble;
}

export function optionsEtagesImmeuble(selected: number | null): { value: string; label: string }[] {
  const set = new Set<number>(VALEURS_ETAGES_IMMEUBLE);
  if (selected != null && selected > 0) set.add(selected);
  return [
    { value: '', label: 'Non renseigné' },
    ...[...set].sort((a, b) => a - b).map((n) => ({ value: String(n), label: libelleEtagesImmeuble(n) })),
  ];
}
