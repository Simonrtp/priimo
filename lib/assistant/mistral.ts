/**
 * Appels Mistral : un seul endroit qui parle au réseau, un seul endroit qui
 * compte les tokens. Le prompt système est toujours le premier message et
 * toujours identique, pour tomber dans le cache de préfixe côté fournisseur.
 */

import { MISTRAL_CHAT_URL, parseUsage, type ModelTier, type TokenUsage, modelFor } from './models';

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

/** Appel simple, sans flux. Rend null si le service n'a rien produit. */
export async function chatOnce(options: ChatOptions): Promise<ChatResult | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(MISTRAL_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelFor(options.tier),
        temperature: 0,
        max_tokens: options.maxTokens,
        ...(options.jsonObject ? { response_format: { type: 'json_object' } } : {}),
        messages: options.messages,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

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
  const fetchImpl = options.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(MISTRAL_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelFor(options.tier),
        temperature: 0,
        max_tokens: options.maxTokens,
        stream: true,
        messages: options.messages,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    });
  } catch {
    return null;
  }
  if (!res.ok || !res.body) return null;

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
