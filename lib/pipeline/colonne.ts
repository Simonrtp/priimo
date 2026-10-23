/** La colonne qui accueille les cartes quand on en retire une : celle d'avant, sinon la première qui reste. */
export function colonneVoisine<T extends { ordre: number }>(
  colonne: { ordre: number },
  autres: readonly T[],
): T | null {
  let avant: T | null = null;
  let premiere: T | null = null;
  for (const autre of autres) {
    if (!premiere || autre.ordre < premiere.ordre) premiere = autre;
    if (autre.ordre < colonne.ordre && (!avant || autre.ordre > avant.ordre)) avant = autre;
  }
  return avant ?? premiere;
}
