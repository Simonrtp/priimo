/**
 * Ce que l'agent tape dans la barre unique : un lieu, une question, ou un nom.
 * Sert à ordonner les résultats, jamais à les filtrer.
 */

/** Un numéro ou un mot de voie : l'agent cherche un lieu. */
export function ressembleAdresse(q: string): boolean {
  return (
    /\d/.test(q) ||
    /\b(rue|av|avenue|bd|boulevard|place|pl|impasse|all[ée]e|chemin|quai|route|cours|square|villa|cit[ée]|passage|r[ée]sidence)\b/i.test(
      q,
    )
  );
}

/** Une phrase qui interroge : l'assistant passe en tête. */
export function ressembleQuestion(q: string): boolean {
  return (
    /\?\s*$/.test(q) ||
    /^(qui|quoi|que|qu['’]|quand|combien|comment|o[uù]|quel|quelle|quels|quelles|est-ce|liste|montre|donne|trouve|r[ée]sume|fais|pourquoi|y a-t-il)\b/i.test(
      q.trim(),
    )
  );
}
