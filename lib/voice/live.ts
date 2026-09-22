/** Intervalle de pré-transcription pendant l’enregistrement. */
export const LIVE_FLUSH_MS = 4000;
export const LIVE_FLUSH_ESTIMATION_MS = 1500;
export const LIVE_FIRST_FLUSH_MS = 1800;
export const LIVE_FIRST_FLUSH_ESTIMATION_MS = 800;
export const LIVE_MIN_BYTES = 2800;
export const LIVE_MIN_BYTES_ESTIMATION = 1200;

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
