import {
  detecterFichier,
  estFichierUpload,
  MAX_RAPPORT_UPLOAD_BYTES,
  MIME_IMAGE_MODELE,
} from '@/lib/rapport/pages';

export type ImageModele = { bytes: Uint8Array; mime: string };

export async function lireImageModele(
  file: unknown,
): Promise<{ ok: true; image: ImageModele } | { ok: false; error: string; status: number } | null> {
  if (file == null || file === '') return null;
  if (!estFichierUpload(file) || file.size === 0) {
    return { ok: false, error: 'Image manquante', status: 400 };
  }
  if (file.size > MAX_RAPPORT_UPLOAD_BYTES) {
    return { ok: false, error: 'Fichier trop lourd (15 Mo max.)', status: 413 };
  }
  const nom = 'name' in file ? String(file.name) : '';
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detecte = detecterFichier({ type: file.type, name: nom }, bytes);
  if (!detecte || detecte.kind !== 'image' || !MIME_IMAGE_MODELE.has(detecte.mime)) {
    return { ok: false, error: 'Image JPEG ou PNG', status: 415 };
  }
  return { ok: true, image: { bytes, mime: detecte.mime } };
}
