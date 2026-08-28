/**
 * Deux niveaux de modèle, décidés à un seul endroit.
 *
 * - `tri`      : tâches de classement — intention, reformulation d'un résultat
 *                court, titre de conversation, résumé roulant.
 * - `synthese` : uniquement une vraie synthèse multi-sources.
 *
 * Surchargeable par variables serveur, pour changer de palier sans toucher au
 * code : MISTRAL_MODEL_TRI, MISTRAL_MODEL_SYNTHESE.
 */

export const MISTRAL_CHAT_URL = 'https://api.mistral.ai/v1/chat/completions';

export type ModelTier = 'tri' | 'synthese';

const DEFAULT_MODEL: Record<ModelTier, string> = {
  tri: 'ministral-3b-latest',
  synthese: 'mistral-small-latest',
};

const ENV_KEY: Record<ModelTier, string> = {
  tri: 'MISTRAL_MODEL_TRI',
  synthese: 'MISTRAL_MODEL_SYNTHESE',
};

export function modelFor(tier: ModelTier): string {
  const override = process.env[ENV_KEY[tier]]?.trim();
  return override || DEFAULT_MODEL[tier];
}

/** Au-delà, une réponse demande de recouper plusieurs lignes : palier haut. */
export const SYNTHESE_MIN_LIGNES = 6;

/**
 * Le palier se décide sur la forme du résultat, pas sur la question :
 * peu de lignes d'un seul type → tri ; le reste → synthèse.
 */
export function tierForAnswer(input: {
  lignesCount: number;
  kinds: readonly string[];
}): ModelTier {
  if (input.lignesCount >= SYNTHESE_MIN_LIGNES) return 'synthese';
  if (new Set(input.kinds).size > 1) return 'synthese';
  return 'tri';
}

export type TokenUsage = { prompt: number; completion: number; total: number };

export const NO_USAGE: TokenUsage = { prompt: 0, completion: 0, total: 0 };

/** `usage` d'une réponse Mistral, tolérant aux champs absents. */
export function parseUsage(raw: unknown): TokenUsage {
  if (!raw || typeof raw !== 'object') return { ...NO_USAGE };
  const u = raw as Record<string, unknown>;
  const prompt = typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0;
  const completion = typeof u.completion_tokens === 'number' ? u.completion_tokens : 0;
  const total =
    typeof u.total_tokens === 'number' ? u.total_tokens : prompt + completion;
  return { prompt, completion, total };
}

/**
 * Le prompt système est long et identique d'un appel à l'autre. Il est envoyé
 * en premier message, octet pour octet le même, pour tomber dans le cache de
 * préfixe côté Mistral. Ne jamais y interpoler de date ni de nom d'agence.
 */
export function stableSystemMessage(content: string): { role: 'system'; content: string } {
  return { role: 'system', content };
}
