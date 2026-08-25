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

/** Rend le texte dicté, ou null si le service n'a rien pu produire. */
export async function transcribeAudio(
  audio: Blob,
  fileName: string,
  apiKey: string,
): Promise<string | null> {
  const form = new FormData();
  form.append('model', TRANSCRIPTION_MODEL);
  form.append('file', audio, fileName);
  // L'agent dicte en français : le préciser améliore nettement les noms propres.
  form.append('language', 'fr');

  const res = await fetch(MISTRAL_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    console.error('[voice] transcription HTTP', res.status, await res.text().catch(() => ''));
    return null;
  }

  const body = (await res.json()) as { text?: string };
  const text = body.text?.trim();
  return text ? text : null;
}
