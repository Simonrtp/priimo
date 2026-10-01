/**
 * Transcription d'une dictée terrain via Voxtral (Mistral).
 *
 * L'audio ne transite jamais par le navigateur d'un tiers : il part du poste de
 * l'agent vers notre route API, qui l'envoie à Mistral et le range dans un
 * bucket privé. Aucune URL publique n'est produite à aucun moment.
 */

const MISTRAL_TRANSCRIPTION_URL = 'https://api.mistral.ai/v1/audio/transcriptions';
/** `voxtral-mini-latest` suit la dernière version (Transcribe V2 aujourd'hui). */
const TRANSCRIPTION_MODEL = process.env.MISTRAL_MODEL_STT?.trim() || 'voxtral-mini-latest';
/** Pré-transcription pendant l'enregistrement : elle doit rester vive. */
export const DELAI_TRANSCRIPTION_LIVE_MS = 12_000;
/** Dictée complète : plusieurs minutes d'audio demandent plus que 12 s. */
export const DELAI_TRANSCRIPTION_NOTE_MS = 45_000;

export class MistralKeyMissingError extends Error {
  constructor() {
    super('MISTRAL_API_KEY_MISSING');
    this.name = 'MistralKeyMissingError';
  }
}

export function requireMistralKey(): string {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) throw new MistralKeyMissingError();
  return apiKey;
}

export type TranscribeOutcome =
  | { ok: true; text: string }
  | { ok: false; kind: 'empty' | 'http' | 'timeout' | 'network'; status?: number };

/** Rend le texte dicté, ou la cause d'échec. */
export async function transcribeAudio(
  audio: Blob,
  fileName: string,
  apiKey: string,
  timeoutMs = DELAI_TRANSCRIPTION_LIVE_MS,
  /** Noms propres à bien orthographier (`context_bias`, 100 termes au plus). */
  vocabulaire: readonly string[] = [],
): Promise<TranscribeOutcome> {
  const form = new FormData();
  form.append('model', TRANSCRIPTION_MODEL);
  form.append('file', audio, fileName);
  form.append('language', 'fr');
  for (const terme of vocabulaire.slice(0, 100)) form.append('context_bias', terme);

  let res: Response;
  try {
    res = await fetch(MISTRAL_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    console.error('[voice] transcription réseau', timedOut ? 'délai dépassé' : error);
    return { ok: false, kind: timedOut ? 'timeout' : 'network' };
  }

  if (!res.ok) {
    console.error('[voice] transcription HTTP', res.status, await res.text().catch(() => ''));
    // Le vocabulaire est un réglage expérimental hors anglais : s'il est refusé,
    // on retranscrit sans lui plutôt que de perdre la dictée.
    if ((res.status === 400 || res.status === 422) && vocabulaire.length > 0) {
      return transcribeAudio(audio, fileName, apiKey, timeoutMs, []);
    }
    return { ok: false, kind: 'http', status: res.status };
  }

  const body = (await res.json()) as { text?: string };
  // Un terme de vocabulaire peut ressortir avec son tiret bas : personne ne dicte « _ ».
  const text = body.text?.replace(/_/g, ' ').trim();
  return text ? { ok: true, text } : { ok: false, kind: 'empty' };
}
