/**
 * Résumé roulant d'un fil. Tourne sur le petit modèle : c'est une tâche de
 * compression, pas de raisonnement.
 */

import { chatOnce } from './mistral';
import { RESUME_MAX_CHARS, type ConversationMessage } from './conversation';
import { stableSystemMessage } from './models';

export const RESUME_SYSTEM_PROMPT =
  "Tu résumes un échange entre un agent immobilier et un outil de recherche dans sa base. Tu gardes uniquement ce qui sert à comprendre les questions suivantes : sujets abordés, adresses, noms, périodes. Tu n'ajoutes aucun fait absent de l'échange. Six lignes au maximum, style télégraphique, pas de formule de politesse.";

const MAX_OUTPUT_TOKENS = 220;
/** Le résumé lui-même est borné en entrée : il ne doit pas coûter cher. */
const MAX_INPUT_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 400;

export type ResumeResult = { texte: string; tokens: number };

export async function regenererResume(
  messages: readonly ConversationMessage[],
  resumePrecedent: string | null,
  apiKey: string,
): Promise<ResumeResult | null> {
  if (messages.length === 0) return null;

  const corps = messages
    .slice(-MAX_INPUT_MESSAGES)
    .map((m) => `${m.role === 'user' ? 'Agent' : 'Outil'} : ${m.contenu.slice(0, MAX_MESSAGE_CHARS)}`)
    .join('\n');

  const entree = resumePrecedent
    ? `Résumé existant :\n${resumePrecedent.slice(0, RESUME_MAX_CHARS)}\n\nNouveaux échanges :\n${corps}`
    : corps;

  const out = await chatOnce({
    tier: 'tri',
    apiKey,
    maxTokens: MAX_OUTPUT_TOKENS,
    timeoutMs: 10_000,
    messages: [
      stableSystemMessage(RESUME_SYSTEM_PROMPT),
      { role: 'user', content: entree },
    ],
  });

  if (!out) return null;
  return { texte: out.texte.slice(0, RESUME_MAX_CHARS), tokens: out.usage.total };
}
