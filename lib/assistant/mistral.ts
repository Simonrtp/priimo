/**
 * Appels Mistral : un seul endroit qui parle au réseau, un seul endroit qui
 * compte les tokens. Le prompt système est toujours le premier message et
 * toujours identique, pour tomber dans le cache de préfixe côté fournisseur.
 */

import { ecarterModele } from '@/lib/mistral/modeles';
import { MISTRAL_CHAT_URL, parseUsage, type ModelTier, type TokenUsage, modelesDuPalier } from './models';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatResult = {
  texte: string;
  usage: TokenUsage;
  /** Vrai quand le fournisseur n'a pas renvoyé d'`usage` : compte approché. */
  usageEstime: boolean;
};

/** ~4 caractères par token en français — repli, jamais une facture. */
function estimerTokens(messages: readonly ChatMessage[], sortie: string): TokenUsage {
  const prompt = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4);
  const completion = Math.ceil(sortie.length / 4);
  return { prompt, completion, total: prompt + completion };
}

export type ChatOptions = {
  tier: ModelTier;
  messages: ChatMessage[];
  apiKey: string;
  maxTokens: number;
  timeoutMs?: number;
  jsonObject?: boolean;
  fetchImpl?: typeof fetch;
};

/**
 * Le premier modèle du palier qui accepte la requête. Un refus (hors forfait,
 * quota) passe au suivant et met le modèle de côté ; une coupure réseau ou un
 * délai dépassé s'arrête là, pour ne pas doubler l'attente.
 */
async function premiereReponse(
  options: ChatOptions,
  corps: Record<string, unknown>,
  timeoutMs: number,
): Promise<Response | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  for (const model of modelesDuPalier(options.tier)) {
    let res: Response;
    try {
      res = await fetchImpl(MISTRAL_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, ...corps }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return null;
    }
    if (res.ok) return res;
    // Requête mal formée : aucun autre modèle n'y répondrait mieux.
    if (res.status === 400 || res.status === 422) return null;
    ecarterModele(model, res.status);
  }
  return null;
}

/** Appel simple, sans flux. Rend null si le service n'a rien produit. */
export async function chatOnce(options: ChatOptions): Promise<ChatResult | null> {
  const res = await premiereReponse(
    options,
    {
      temperature: 0,
      max_tokens: options.maxTokens,
      ...(options.jsonObject ? { response_format: { type: 'json_object' } } : {}),
      messages: options.messages,
    },
    options.timeoutMs ?? 12_000,
  );
  if (!res) return null;

  try {
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: unknown;
    };
    const texte = body.choices?.[0]?.message?.content?.trim();
    if (!texte) return null;
    const usage = parseUsage(body.usage);
    if (usage.total > 0) return { texte, usage, usageEstime: false };
    return { texte, usage: estimerTokens(options.messages, texte), usageEstime: true };
  } catch {
    return null;
  }
}

/** Un fragment de texte au fil de l'eau. */
export type DeltaHandler = (fragment: string) => void;

/**
 * Appel en flux. `onDelta` reçoit chaque fragment ; le texte complet et les
 * tokens sont rendus à la fin. Rend null si rien n'a pu être produit.
 */
export async function chatStream(
  options: ChatOptions & { onDelta: DeltaHandler },
): Promise<ChatResult | null> {
  const res = await premiereReponse(
    options,
    {
      temperature: 0,
      max_tokens: options.maxTokens,
      stream: true,
      messages: options.messages,
    },
    options.timeoutMs ?? 30_000,
  );
  if (!res?.body) return null;

  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  let buffer = '';
  let texte = '';
  let usage: TokenUsage | null = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let cut = buffer.indexOf('\n');
      while (cut >= 0) {
        const line = buffer.slice(0, cut).trim();
        buffer = buffer.slice(cut + 1);
        cut = buffer.indexOf('\n');
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const chunk = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: unknown;
          };
          const fragment = chunk.choices?.[0]?.delta?.content;
          if (fragment) {
            texte += fragment;
            options.onDelta(fragment);
          }
          if (chunk.usage) {
            const parsed = parseUsage(chunk.usage);
            if (parsed.total > 0) usage = parsed;
          }
        } catch {
          // fragment illisible : on continue, le texte déjà reçu reste valable
        }
      }
    }
  } catch {
    if (!texte) return null;
  } finally {
    reader.releaseLock();
  }

  if (!texte.trim()) return null;
  if (usage) return { texte: texte.trim(), usage, usageEstime: false };
  return {
    texte: texte.trim(),
    usage: estimerTokens(options.messages, texte),
    usageEstime: true,
  };
}
