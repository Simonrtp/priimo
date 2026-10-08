/**
 * Le lien dit entre deux personnes d'une note (« Christine est la sœur de
 * Simon »), lu depuis la carte de Christine vers celle de Simon : la capsule
 * « Simon Ropiot » porte « Sœur de ».
 */

function sansAccent(x: string): string {
  return x.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr');
}

const CIVILITES = /\s*\b(m\.?|mme|mlle|monsieur|madame|mademoiselle)\s*$/i;

/**
 * `null` quand la relation ne nomme pas l'autre personne : on ne devine pas
 * un lien que la note n'a pas dit.
 */
export function prefixeRelation(
  relation: string | null | undefined,
  autre: { firstName: string; lastName: string },
): string | null {
  const texte = relation?.trim();
  if (!texte) return null;
  const cible = sansAccent(texte);
  for (const nom of [autre.firstName, autre.lastName]) {
    const n = nom.trim();
    if (n.length < 2) continue;
    const i = cible.indexOf(sansAccent(n));
    if (i <= 0) continue;
    const avant = texte.slice(0, i).replace(CIVILITES, '').replace(/[\s,;:]+$/, '').trim();
    if (!avant) continue;
    return avant[0]!.toLocaleUpperCase('fr') + avant.slice(1);
  }
  return null;
}
