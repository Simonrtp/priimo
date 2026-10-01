/** Intervalle de pré-transcription pendant l’enregistrement. */
export const LIVE_FLUSH_MS = 4000;
export const LIVE_FLUSH_ESTIMATION_MS = 1500;
export const LIVE_FIRST_FLUSH_MS = 1800;
export const LIVE_FIRST_FLUSH_ESTIMATION_MS = 800;
export const LIVE_MIN_BYTES = 2800;
export const LIVE_MIN_BYTES_ESTIMATION = 1200;

/**
 * Délai avant la prochaine pré-transcription.
 *
 * Chaque passe renvoie tout l'audio depuis le début (un morceau de webm seul
 * n'est pas lisible). À intervalle fixe, le coût croissait comme le carré de la
 * durée : trois minutes de note faisaient transcrire plus d'une heure d'audio.
 * En espaçant les passes à mesure que la dictée s'allonge, on reste autour de
 * trois fois la durée réelle, et le texte n'est jamais en retard de plus
 * d'un tiers de ce qui a été dit.
 */
export function prochainDelaiLive(elapsedMs: number, estimation: boolean): number {
  if (estimation) return Math.max(LIVE_FLUSH_ESTIMATION_MS, Math.round(elapsedMs * 0.25));
  return Math.max(LIVE_FLUSH_MS, Math.round(elapsedMs * 0.5));
}

export async function transcribeBlob(blob: Blob): Promise<string | null> {
  const form = new FormData();
  form.append('audio', blob, 'live.webm');
  const res = await fetch('/api/dashboard/voice-notes/transcribe', { method: 'POST', body: form });
  if (!res.ok) return null;
  const data = (await res.json()) as { text?: string };
  const text = data.text?.trim();
  return text || null;
}

export async function transcribeLive(
  blob: Blob,
  minBytes = LIVE_MIN_BYTES,
): Promise<string | null> {
  if (blob.size < minBytes) return null;
  return transcribeBlob(blob);
}

export async function hydrateNoteReview(
  voiceNoteId: string,
  transcript: string,
): Promise<import('@/lib/notes/build-review').NoteReviewPayload | null> {
  const res = await fetch(`/api/dashboard/voice-notes/${voiceNoteId}/rafraichir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) return null;
  return (await res.json()) as import('@/lib/notes/build-review').NoteReviewPayload;
}
