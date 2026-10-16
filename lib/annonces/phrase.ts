/** Ligne du brief : mouvements du secteur, jamais une notification par annonce. */

export function phraseMouvements(baisses: number, retraits: number): string | null {
  if (baisses <= 0 && retraits <= 0) return null;
  const baisse =
    baisses === 1 ? '1 baisse de prix' : baisses > 1 ? `${baisses} baisses de prix` : null;
  const retrait =
    retraits === 1 ? '1 annonce retirée' : retraits > 1 ? `${retraits} annonces retirées` : null;
  const corps = [baisse, retrait].filter(Boolean).join(' et ');
  return `${corps} dans mon secteur`;
}

export function titreNouvelles(n: number): string {
  return n === 1
    ? '1 nouvelle annonce de particulier dans mon secteur'
    : `${n} nouvelles annonces de particuliers dans mon secteur`;
}

export const LIEN_ANNONCES_MOUVEMENTS = '/dashboard/annonces?mouvements=1';
export const LIEN_ANNONCES_NOUVELLES = '/dashboard/annonces?nouvelles=1';
