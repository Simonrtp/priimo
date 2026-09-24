export const BIEN_PHOTOS_BUCKET = 'bien-photos';
export const BIEN_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const BIEN_PHOTO_MAX_COUNT = 20;

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|avi|mkv|mpeg|mpg|3gp)$/i;
const PHOTO_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

export type BienPhotoMime = keyof typeof MIME_TO_EXT;

export type MimePhotoResolu = { mime: BienPhotoMime } | { error: string };

export function extensionForBienPhoto(mime: string): string | null {
  const key = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  if (key === 'image/jpg') return 'jpg';
  return MIME_TO_EXT[key as BienPhotoMime] ?? null;
}

export function isBienPhotoMime(mime: string): mime is BienPhotoMime {
  return extensionForBienPhoto(mime) != null;
}

/** Next/undici : File de FormData n’est pas toujours `instanceof Blob`. */
export function estBlobRecu(v: unknown): v is Blob {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Blob).size === 'number' &&
    typeof (v as Blob).arrayBuffer === 'function' &&
    typeof (v as Blob).slice === 'function'
  );
}

export function mimeDepuisSignature(octets: Uint8Array): BienPhotoMime | 'heic' | 'video' | null {
  if (octets.length < 12) return null;
  if (octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) return 'image/jpeg';
  if (octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47) {
    return 'image/png';
  }
  if (
    octets[0] === 0x52 &&
    octets[1] === 0x49 &&
    octets[2] === 0x46 &&
    octets[3] === 0x46 &&
    octets[8] === 0x57 &&
    octets[9] === 0x45 &&
    octets[10] === 0x42 &&
    octets[11] === 0x50
  ) {
    return 'image/webp';
  }
  const brand = String.fromCharCode(...octets.subarray(4, 8));
  if (brand !== 'ftyp') return null;
  const sous = String.fromCharCode(...octets.subarray(8, 12)).toLowerCase();
  if (/^(heic|heix|heif|hevc|mif1|msf1)/.test(sous)) return 'heic';
  return 'video';
}

export function resoudreMimePhoto(declare: string, octets: Uint8Array): MimePhotoResolu {
  const sniff = mimeDepuisSignature(octets);
  if (sniff === 'heic') {
    return { error: 'Les photos HEIC ne sont pas acceptées. Choisissez JPEG ou PNG dans la galerie.' };
  }
  if (sniff === 'video') {
    return { error: 'Seules les photos sont acceptées, pas les vidéos.' };
  }
  if (sniff) return { mime: sniff };
  const key = declare.split(';')[0]?.trim().toLowerCase() ?? '';
  const normalise = key === 'image/jpg' ? 'image/jpeg' : key;
  if (isBienPhotoMime(normalise)) return { mime: normalise };
  return { error: 'Formats acceptés : JPEG, PNG, WebP' };
}

export function estFichierPhoto(file: { name: string; type: string }): boolean {
  const type = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  if (type.startsWith('video/') || VIDEO_EXT.test(file.name)) return false;
  if (type.startsWith('image/')) return !type.includes('svg');
  if (PHOTO_EXT.test(file.name)) return true;
  return type === '' || type === 'application/octet-stream';
}

export async function uploadBienPhotoFile(file: File): Promise<{ url?: string; error?: string }> {
  if (!estFichierPhoto(file)) {
    return { error: 'Seules les photos sont acceptées, pas les vidéos.' };
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/dashboard/biens/photos', { method: 'POST', body: form });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    return { error: data.error ?? "La photo n'a pas pu être enregistrée" };
  }
  return { url: data.url };
}
