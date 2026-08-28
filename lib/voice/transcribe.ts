/**
 * Transcription d'une dictée terrain via Voxtral (Mistral).
 *
 * L'audio ne transite jamais par le navigateur d'un tiers : il part du poste de
 * l'agent vers notre route API, qui l'envoie à Mistral et le range dans un
 * bucket privé. Aucune URL publique n'est produite à aucun moment.
 */

const MISTRAL_TRANSCRIPTION_URL = 'https://api.mistral.ai/v1/audio/transcriptions';
const TRANSCRIPTION_MODEL = 'voxtral-mini-latest';

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
): Promise<TranscribeOutcome> {
  const form = new FormData();
  form.append('model', TRANSCRIPTION_MODEL);
  form.append('file', audio, fileName);
  form.append('language', 'fr');

  let res: Response;
  try {
    res = await fetch(MISTRAL_TRANSCRIPTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    console.error('[voice] transcription réseau', error);
    return { ok: false, kind: timedOut ? 'timeout' : 'network' };
  }

  if (!res.ok) {
    console.error('[voice] transcription HTTP', res.status, await res.text().catch(() => ''));
    return { ok: false, kind: 'http', status: res.status };
  }

  const body = (await res.json()) as { text?: string };
  const text = body.text?.trim();
  return text ? { ok: true, text } : { ok: false, kind: 'empty' };
}
