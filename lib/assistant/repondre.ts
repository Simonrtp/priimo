/**
 * Temps 2 : lignes collectées → français. Température 0.
 * Si l'appel échoue ou dépasse 8 secondes : données brutes, pas une erreur.
 */

import { formatBrut } from './format-brut';
import { payloadPourModele, type CollecteResult } from './collecte';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';
export const REFORMULER_TIMEOUT_MS = 8000;
const MAX_OUTPUT_TOKENS = 400;

export const REFORMULER_SYSTEM_PROMPT =
  "Tu reformules en français des données d'une base immobilière. Tu n'ajoutes aucune information absente des données fournies. Tu n'interprètes pas, tu n'extrapoles pas, tu ne suggères aucune action. Si une donnée manque, tu ne la devines pas : tu ne la mentionnes pas. Chaque fait que tu énonces doit correspondre à un champ présent dans les données. Tu ne cites aucune personne, adresse ou téléphone absent des lignes. Réponse courte, factuelle, au maximum six phrases. Pas de formule de politesse, pas de conclusion.";

type FetchLike = typeof fetch;

export async function reformulerLignes(
  question: string,
  collecte: CollecteResult,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ texte: string; brut: boolean }> {
  const brut = formatBrut(collecte);
  const payload = JSON.stringify(payloadPourModele(collecte));

  let res: Response;
  try {
    res = await fetchImpl(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: 'system', content: REFORMULER_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Question : ${question}\n\nDonnées :\n${payload}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(REFORMULER_TIMEOUT_MS),
    });
  } catch {
    return { texte: brut, brut: true };
  }

  if (!res.ok) return { texte: brut, brut: true };

  try {
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) return { texte: brut, brut: true };
    return { texte: content, brut: false };
  } catch {
    return { texte: brut, brut: true };
  }
}
