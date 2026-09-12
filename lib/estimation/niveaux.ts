/** Nombre de niveaux du logement (étages internes au bien). */
export const VALEURS_NIVEAUX = [1, 2, 3, 4, 5] as const;

export type ValeurNiveaux = (typeof VALEURS_NIVEAUX)[number];

export function libelleNiveaux(n: number): string {
  if (n === 1) return 'Plain-pied';
  if (n === 5) return '5 niveaux et plus';
  return `${n} niveaux`;
}

export function optionsNiveaux(selected: number | null): { value: string; label: string }[] {
  const set = new Set<number>(VALEURS_NIVEAUX);
  if (selected != null && selected > 0) set.add(selected);
  return [
    { value: '', label: 'Non renseigné' },
    ...[...set].sort((a, b) => a - b).map((n) => ({ value: String(n), label: libelleNiveaux(n) })),
  ];
}
