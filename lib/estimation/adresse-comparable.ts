/**
 * Affichage des adresses DVF dans l’avis.
 * Défaut : la rue, sans numéro. L’adresse complète se règle par agence.
 */
export type ModeAdresseComparable = 'rue' | 'complete';

export function formaterAdresseComparable(
  adresse: string | null | undefined,
  mode: ModeAdresseComparable = 'rue',
): string | null {
  const raw = adresse?.trim();
  if (!raw) return null;
  if (mode === 'complete') return raw;
  return rueSeule(raw);
}

/** « 12 rue Alphonse Penaud 75020 Paris » → « rue Alphonse Penaud ». */
export function rueSeule(adresse: string): string {
  const sansCp = adresse.replace(/\s+\d{5}\b.*$/, '').trim();
  const sansNumero = sansCp.replace(/^\d+\s*(bis|ter|quater)?\s*/i, '').trim();
  return sansNumero || sansCp || adresse;
}
