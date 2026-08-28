/**
 * Temps 1 : question → intention JSON. Température 0. Jamais de SQL.
 *
 * Filet de sécurité derrière `router.ts` : n'est appelé que lorsque le
 * routage par règles n'a rien reconnu. C'est une tâche de tri, donc le
 * palier `tri` (plus petit modèle).
 */

import { requireMistralKey } from '@/lib/voice/transcribe';
import { chatOnce } from './mistral';
import { stableSystemMessage } from './models';
import {
  EMPTY_INTENT,
  INTERPRET_EXAMPLES,
  parseIntent,
  type AssistantIntent,
} from './intent';

const MAX_QUESTION = 500;
const MAX_OUTPUT_TOKENS = 280;

function examplesBlock(): string {
  return INTERPRET_EXAMPLES.map(
    (ex) => `Q: ${ex.question}\n${JSON.stringify(ex.intent)}`,
  ).join('\n');
}

export const INTERPRET_SYSTEM_PROMPT = `Tu traduis une question d'agent immobilier français en filtres de recherche. Tu réponds uniquement par un objet JSON, sans markdown, sans préambule, sans commentaire.
Tu n'inventes aucun fait. Tu n'extrais que ce qui est explicitement dit.

Schéma:
{"type":"immeuble"|"personne"|"recherche_acquereur"|"activite"|"inconnu","adresse":string|null,"code_postal":string|null,"nom":string|null,"periode_jours":number|null,"filtres":{"type_contact":"vendeur"|"acquereur"|"locataire"|"autre"|null,"statut_mandat":"estimation"|"mandat_simple"|"mandat_exclusif"|"compromis"|"vendu"|"archive"|null}}

type:
- immeuble : question sur une adresse, un bâtiment, un mandat à une adresse
- personne : question sur un nom de contact
- recherche_acquereur : qui cherche un bien, acquéreurs correspondant à un secteur ou une adresse
- activite : activité récente de l'agence, ou « que dois-je faire aujourd'hui / cette semaine »
- inconnu : tout le reste (météo, conseil, estimation de marché, opinion, question hors base)

periode_jours : 1 pour aujourd'hui ou « que faire aujourd'hui », 7 pour cette semaine, 30 pour ce mois, ou le nombre dit. Null sinon.
code_postal : uniquement un code à 5 chiffres s'il est dit.

Exemples:
${examplesBlock()}`;

type FetchLike = typeof fetch;

export async function interpretQuestion(
  question: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<AssistantIntent> {
  const trimmed = question.trim().slice(0, MAX_QUESTION);
  if (!trimmed) return { ...EMPTY_INTENT };

  const out = await chatOnce({
    tier: 'tri',
    apiKey,
    maxTokens: MAX_OUTPUT_TOKENS,
    jsonObject: true,
    fetchImpl,
    messages: [
      stableSystemMessage(INTERPRET_SYSTEM_PROMPT),
      { role: 'user', content: trimmed },
    ],
  });

  return out ? parseIntent(out.texte) : { ...EMPTY_INTENT };
}

export function interpretWithConfiguredKey(question: string): Promise<AssistantIntent> {
  return interpretQuestion(question, requireMistralKey());
}
