/**
 * Filtres de sortie des textes dits au propriétaire (scripts d'approche,
 * phrase d'ouverture du brief de porte). Purs : utilisables côté client.
 */

/** Fuites de méthode — pas les faits métier (diagnostic, ventes, etc.). */
export const LEAK_PATTERNS =
  /\b(dvf|bodacc|algorithme|score|signal|pr[eé]dictif|donn[eé]es\s+publiques|base\s+de\s+donn[eé]es)\b/i;

/** Mentions d'achat / détention — interdites produit. */
export const ACQUISITION_LEAK =
  /\b(acquis|acquisition|achet[eé]|achat|d[eé]tention|depuis\s+\d+\s+ans?|il\s+y\s+a\s+\d+\s+ans?\s+que|propri[eé]taire\s+depuis|achet[eé]\s+en\s+\d{4}|en\s+\d{4}\s*[,\.]?\s*(vous\s+avez\s+)?achet)\b/i;

/** Canal figé (téléphone / porte) — « je vous contacte » est autorisé. */
export const CHANNEL_LEAK =
  /\b(je\s+vous\s+(appelle|t[eé]l[eé]phone|joi[gn]ds|joinds)|je\s+vous\s+[eé]cris|au\s+t[eé]l[eé]phone|coup\s+de\s+fil|suite\s+[aà]\s+mon\s+appel|je\s+passe\s+un\s+coup|je\s+me\s+permets\s+de\s+venir|venir\s+vous\s+voir|passer\s+[aà]\s+la\s+porte)\b/i;

/**
 * À la porte, rien ne trahit l'outil : ni la lettre du diagnostic, ni le mot
 * « données », ni l'intelligence artificielle.
 */
export const PORTE_LEAK =
  /\b(dpe|diagnostics?|donn[eé]es?|scores?|signa(l|ux)|algorithmes?|ia|intelligence\s+artificielle|fichiers?|registres?|cadastre|base)\b/i;

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Les filtres des scripts d'approche, tels qu'ils s'appliquent au texte généré. */
export function passeFiltresApproche(texte: string): boolean {
  const s = stripAccents(texte);
  return !LEAK_PATTERNS.test(s) && !ACQUISITION_LEAK.test(s) && !CHANNEL_LEAK.test(s);
}

/** Ce qui se dit à voix haute devant la porte : scripts d'approche, plus aucune trace de la méthode. */
export function passeFiltresPorte(texte: string): boolean {
  return passeFiltresApproche(texte) && !PORTE_LEAK.test(stripAccents(texte));
}
