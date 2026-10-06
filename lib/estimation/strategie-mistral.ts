import { parserStrategie, promptStrategie, type FicheStrategie } from '@/lib/estimation/strategie';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';

/**
 * Forces / faiblesses à partir des seuls faits saisis.
 * Si Mistral est indisponible, listes vides : l’agent rédige.
 */
export async function proposerStrategie(fiche: FicheStrategie): Promise<{
  forces: string[];
  faiblesses: string[];
}> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) return { forces: [], faiblesses: [] };
  const prompt = promptStrategie(fiche);
  if (!prompt.includes('- ')) return { forces: [], faiblesses: [] };

  try {
    const res = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Tu rédiges uniquement à partir des faits fournis. Tu n’inventes rien. JSON strict.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) return { forces: [], faiblesses: [] };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? '';
    return parserStrategie(raw);
  } catch {
    return { forces: [], faiblesses: [] };
  }
}
