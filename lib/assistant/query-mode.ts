/**
 * Décide si une saisie appelle l'assistant IA en plus de la recherche classique.
 */

const QUESTION_START =
  /^(qui|quoi|que|quel|quelle|quels|quelles|combien|où|ou|comment|pourquoi|est-ce|y a-t-il|des nouvelles|que faire|qu'est|qu’|activité|activite|cherche|cherchent|acquéreur|acquereur|quels sont|liste|montre|donne|dis-moi|dis moi)\b/i;

const ACTIVITY_PHRASES =
  /\b(aujourd'hui|aujourdhui|cette semaine|ce mois|activité récente|activite recente|que dois|todo|à faire|a faire)\b/i;

/** Vrai → lancer aussi le pipeline Mistral (interpréter + répondre). */
export function needsAiAnswer(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (q.includes('?')) return true;
  if (QUESTION_START.test(q)) return true;
  if (ACTIVITY_PHRASES.test(q)) return true;
  // Phrases longues : plutôt une question qu'un mot-clé.
  if (q.length > 48 && q.includes(' ')) return true;
  return false;
}
