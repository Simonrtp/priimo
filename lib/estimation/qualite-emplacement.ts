import { CRITERE_NOTE_LABELS, CRITERE_NOTES } from '@/lib/estimation/grille';

const VALEURS_QUALITE_EMPLACEMENT = CRITERE_NOTES.map((n) => CRITERE_NOTE_LABELS[n]);

export function optionsQualiteEmplacement(selected: string | null): { value: string; label: string }[] {
  const courant = selected?.trim();
  const labels =
    courant &&
    !VALEURS_QUALITE_EMPLACEMENT.includes(courant as (typeof VALEURS_QUALITE_EMPLACEMENT)[number])
      ? [courant, ...VALEURS_QUALITE_EMPLACEMENT]
      : [...VALEURS_QUALITE_EMPLACEMENT];
  return [
    { value: '', label: 'Non renseigné' },
    ...labels.map((label) => ({ value: label, label })),
  ];
}
