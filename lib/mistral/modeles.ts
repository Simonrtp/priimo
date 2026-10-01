/**
 * Chaînes de modèles Mistral et mémoire des refus.
 *
 * Le meilleur modèle d'abord ; le suivant prend le relais s'il est hors forfait
 * (403 « tier_not_allowed »), saturé (429) ou en panne. Constaté sur la clé
 * actuelle : `mistral-large` est hors forfait, `medium` et `small` épuisent
 * leur quota, `ministral-14b` et `8b` répondent. Passer au forfait payant
 * débloque le haut de la liste sans toucher au code.
 *
 * Un modèle refusé est mis de côté un moment : inutile de reperdre un
 * aller-retour sur chaque note.
 */

export const MODELES_PROFONDS: readonly string[] = [
  'mistral-large-latest',
  'mistral-medium-latest',
  'mistral-small-latest',
  'ministral-14b-latest',
  'ministral-8b-latest',
];

/** Pendant la dictée : répondre en une ou deux secondes prime. */
export const MODELES_RAPIDES: readonly string[] = [
  'mistral-small-latest',
  'ministral-14b-latest',
  'ministral-8b-latest',
];

const ecartes = new Map<string, number>();

/** Hors forfait : une heure. Quota ou panne : une minute. */
export function ecarterModele(model: string, status: number): void {
  const duree = status === 401 || status === 403 || status === 404 ? 60 * 60_000 : 60_000;
  ecartes.set(model, Date.now() + duree);
}

function disponible(model: string): boolean {
  const jusqua = ecartes.get(model);
  if (!jusqua) return true;
  if (Date.now() > jusqua) {
    ecartes.delete(model);
    return true;
  }
  return false;
}

/**
 * Les modèles à essayer, dans l'ordre. Celui imposé par l'environnement passe
 * devant. Si tous sont écartés, on retente quand même toute la liste : mieux
 * vaut un appel de trop qu'une note jamais lue.
 */
export function chaineModeles(liste: readonly string[], impose?: string | null): string[] {
  const ordre = impose?.trim() ? [impose.trim(), ...liste.filter((m) => m !== impose.trim())] : [...liste];
  const libres = ordre.filter(disponible);
  return libres.length > 0 ? libres : ordre;
}
