/**
 * Temps 1 : question → intention JSON. Température 0. Jamais de SQL.
 */

import { requireMistralKey } from '@/lib/voice/transcribe';
import {
  EMPTY_INTENT,
  INTERPRET_EXAMPLES,
  parseIntent,
  type AssistantIntent,
} from './intent';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';
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
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: INTERPRET_SYSTEM_PROMPT },
          { role: 'user', content: trimmed },
        ],
      }),
    });
  } catch {
    return { ...EMPTY_INTENT };
  }

  if (!res.ok) return { ...EMPTY_INTENT };

  let content: string | undefined;
  try {
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    content = body.choices?.[0]?.message?.content;
  } catch {
    return { ...EMPTY_INTENT };
  }

  return parseIntent(content);
}

export function interpretWithConfiguredKey(question: string): Promise<AssistantIntent> {
  return interpretQuestion(question, requireMistralKey());
}
