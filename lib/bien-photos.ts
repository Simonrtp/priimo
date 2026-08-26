export const BIEN_PHOTOS_BUCKET = 'bien-photos';
export const BIEN_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const BIEN_PHOTO_MAX_COUNT = 20;

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type BienPhotoMime = keyof typeof MIME_TO_EXT;

export function extensionForBienPhoto(mime: string): string | null {
  const key = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (key === 'image/jpg') return 'jpg';
  return MIME_TO_EXT[key as BienPhotoMime] ?? null;
}

export function isBienPhotoMime(mime: string): mime is BienPhotoMime {
  return extensionForBienPhoto(mime) != null;
}

export async function uploadBienPhotoFile(file: File): Promise<{ url?: string; error?: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/dashboard/biens/photos', { method: 'POST', body: form });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    return { error: data.error ?? "La photo n'a pas pu être enregistrée" };
  }
  return { url: data.url };
}
