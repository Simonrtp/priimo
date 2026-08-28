/** Seuil empirique : en dessous, Voxtral renvoie souvent du vide. */
export const MIN_VOICE_BYTES = 2400;

/** Durée minimale d'enregistrement avant envoi (ms). */
export const MIN_VOICE_RECORD_MS = 800;

export function normalizeAudioMime(type: string | undefined): string {
  return (type || 'audio/webm').split(';')[0]!.trim();
}

export function extensionForAudioMime(mime: string): string {
  if (mime.startsWith('audio/ogg')) return 'ogg';
  if (mime.startsWith('audio/mpeg')) return 'mp3';
  if (mime.startsWith('audio/mp4')) return 'm4a';
  if (mime.startsWith('audio/wav')) return 'wav';
  return 'webm';
}

export function fileNameForAudioBlob(blob: Blob, stem = 'audio'): string {
  const ext = extensionForAudioMime(normalizeAudioMime(blob.type));
  return `${stem}.${ext}`;
}

export function isVoiceBlobTooSmall(size: number): boolean {
  return size < MIN_VOICE_BYTES;
}
