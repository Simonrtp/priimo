import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export const BIEN_PHOTOS_BUCKET = 'bien-photos';
export const BIEN_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const BIEN_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const BIEN_PHOTO_MAX_COUNT = 20;

/** Attribut `accept` commun aux sélecteurs photo/vidéo bien & estimation. */
export const BIEN_MEDIA_ACCEPT =
  'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov';

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
} as const;

const VIDEO_EXT = /\.(mp4|m4v|mov|webm)$/i;
const PHOTO_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const MEDIA_EXT = /\.(jpe?g|png|webp|mp4|m4v|mov|webm)$/i;

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

export function estMimeVideo(mime: string): boolean {
  const key = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  return key.startsWith('video/');
}

export function tailleMaxPourMime(mime: string): number {
  return estMimeVideo(mime) ? BIEN_VIDEO_MAX_BYTES : BIEN_PHOTO_MAX_BYTES;
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

function brandFtyp(octets: Uint8Array): string | null {
  if (octets.length < 12) return null;
  const brand = String.fromCharCode(...octets.subarray(4, 8));
  if (brand !== 'ftyp') return null;
  return String.fromCharCode(...octets.subarray(8, 12)).toLowerCase();
}

export function mimeDepuisSignature(
  octets: Uint8Array,
): BienPhotoMime | 'heic' | null {
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
  // WebM (EBML)
  if (octets[0] === 0x1a && octets[1] === 0x45 && octets[2] === 0xdf && octets[3] === 0xa3) {
    return 'video/webm';
  }
  const sous = brandFtyp(octets);
  if (!sous) return null;
  if (/^(heic|heix|heif|hevc|mif1|msf1)/.test(sous)) return 'heic';
  if (/^(qt  |mqt )/.test(sous)) return 'video/quicktime';
  if (/^(isom|iso2|mp41|mp42|avc1|dash|msdh|m4v |ndas|ndsc|ndsh|ndsm|ndsp|ndss|ndxc|ndxh|ndxm|ndxp|ndxs)/.test(sous)) {
    return 'video/mp4';
  }
  // Autres conteneurs ISO BMFF : on traite comme MP4 (téléphones / GoPro).
  return 'video/mp4';
}

export function resoudreMimePhoto(
  declare: string,
  octets: Uint8Array,
  name = '',
): MimePhotoResolu {
  const sniff = mimeDepuisSignature(octets);
  if (sniff === 'heic') {
    return { error: 'Les photos HEIC ne sont pas acceptées. Choisissez JPEG ou PNG dans la galerie.' };
  }
  if (sniff) return { mime: sniff };

  const key = declare.split(';')[0]?.trim().toLowerCase() ?? '';
  const normalise = key === 'image/jpg' ? 'image/jpeg' : key;
  if (isBienPhotoMime(normalise)) return { mime: normalise };

  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'jpg' || ext === 'jpeg') return { mime: 'image/jpeg' };
  if (ext === 'png') return { mime: 'image/png' };
  if (ext === 'webp') return { mime: 'image/webp' };
  if (ext === 'mp4' || ext === 'm4v') return { mime: 'video/mp4' };
  if (ext === 'webm') return { mime: 'video/webm' };
  if (ext === 'mov') return { mime: 'video/quicktime' };

  return { error: 'Formats acceptés : JPEG, PNG, WebP, MP4, WebM, MOV' };
}

/** Filtre galerie : photos + vidéos acceptées (pas SVG / formats exotiques). */
export function estFichierPhoto(file: { name: string; type: string }): boolean {
  const type = file.type.split(';')[0]?.trim().toLowerCase() ?? '';
  if (type.includes('svg') || type === 'image/gif' || type === 'image/heic' || type === 'image/heif') {
    return false;
  }
  if (type.startsWith('image/') || type.startsWith('video/')) return true;
  if (MEDIA_EXT.test(file.name)) return true;
  if (PHOTO_EXT.test(file.name) && !/\.(heic|heif)$/i.test(file.name)) return true;
  return type === '' || type === 'application/octet-stream';
}

export function estUrlVideo(url: string): boolean {
  try {
    const path = new URL(url, 'https://local.invalid').pathname;
    return VIDEO_EXT.test(path);
  } catch {
    return VIDEO_EXT.test(url);
  }
}

type PrepareResponse = {
  path?: string;
  token?: string;
  publicUrl?: string;
  error?: string;
};

/**
 * Envoi direct vers le storage (URL signée) : contourne la limite de corps
 * des fonctions Vercel, indispensable pour les vidéos et les gros JPEG.
 */
export async function uploadBienPhotoFile(file: File): Promise<{ url?: string; error?: string }> {
  if (!estFichierPhoto(file)) {
    return { error: 'Formats acceptés : JPEG, PNG, WebP, MP4, WebM, MOV' };
  }

  const entete = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const resolu = resoudreMimePhoto(file.type || '', entete, file.name);
  if ('error' in resolu) return { error: resolu.error };

  const max = tailleMaxPourMime(resolu.mime);
  if (file.size > max) {
    return {
      error: estMimeVideo(resolu.mime)
        ? 'Vidéo trop lourde (50 Mo maximum)'
        : 'Photo trop lourde (8 Mo maximum)',
    };
  }

  const prepareRes = await fetch('/api/dashboard/biens/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mime: resolu.mime, size: file.size, name: file.name }),
  });
  const prepare = (await prepareRes.json()) as PrepareResponse;
  if (!prepareRes.ok || !prepare.path || !prepare.token || !prepare.publicUrl) {
    return { error: prepare.error ?? "Le média n'a pas pu être enregistré" };
  }

  const supabase = createSupabaseBrowserClient();
  const { error: uploadError } = await supabase.storage
    .from(BIEN_PHOTOS_BUCKET)
    .uploadToSignedUrl(prepare.path, prepare.token, file, { contentType: resolu.mime });

  if (uploadError) {
    console.error('[biens] media upload', uploadError);
    return { error: "Le média n'a pas pu être enregistré" };
  }

  const verifyRes = await fetch('/api/dashboard/biens/photos', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: prepare.path }),
  });
  const verify = (await verifyRes.json()) as { url?: string; error?: string };
  if (!verifyRes.ok || !verify.url) {
    return { error: verify.error ?? "Le média n'a pas pu être enregistré" };
  }

  return { url: verify.url };
}
