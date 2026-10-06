/**
 * Affichage des adresses DVF dans l’avis.
 * Une seule constante : passer à « rue seulement » sans réécrire les pages.
 * L’avis de l’avocat n’est pas encore rendu — on garde l’adresse complète.
 */
export const COMPARABLE_ADDRESS_MODE = 'full' as 'full' | 'street_only';

export function formaterAdresseComparable(adresse: string | null | undefined): string | null {
  const raw = adresse?.trim();
  if (!raw) return null;
  if (COMPARABLE_ADDRESS_MODE === 'full') return raw;
  return rueSeule(raw);
}

/** « 12 rue Alphonse Penaud 75020 Paris » → « rue Alphonse Penaud ». */
export function rueSeule(adresse: string): string {
  const sansCp = adresse.replace(/\s+\d{5}\b.*$/, '').trim();
  const sansNumero = sansCp.replace(/^\d+\s*(bis|ter|quater)?\s*/i, '').trim();
  return sansNumero || sansCp || adresse;
}
