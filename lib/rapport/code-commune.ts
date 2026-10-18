/**
 * Code commune INSEE.
 * À Paris, l’arrondissement est les 5 premiers caractères du parcelle_id (75101–75120).
 */
export function codeCommuneInsee(input: {
  parcelleId: string | null | undefined;
  postalCode?: string | null;
}): string | null {
  const brut = (input.parcelleId ?? '').trim().toUpperCase();
  const cinq = brut.slice(0, 5);
  if (/^(?:\d{5}|\d[0-9AB]\d{3})$/.test(cinq)) return cinq;
  const cp = (input.postalCode ?? '').trim();
  const arr = /^75(0\d{2})$/.exec(cp);
  if (arr && arr[1] !== '000') return `751${arr[1]!.slice(1)}`;
  return null;
}
