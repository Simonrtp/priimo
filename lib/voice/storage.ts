/**
 * Rangement des dictées dans le bucket privé `voice-notes`.
 *
 * Une note peut avoir plusieurs prises (« Compléter la dictée ») : la première
 * vit à `storage_path`, chaque suivante dans un fichier voisin
 * `<agence>/<note>.prise-<id>.<ext>`. Réécrire la première prise avec la
 * seconde faisait perdre le début de la dictée.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const VOICE_BUCKET = 'voice-notes';

type Client = SupabaseClient<Database>;

export type PriseAudio = { path: string; createdAt: string | null };

export function extensionAudio(mime: string): string {
  if (mime.startsWith('audio/ogg')) return 'ogg';
  if (mime.startsWith('audio/mpeg')) return 'mp3';
  if (mime.startsWith('audio/mp4')) return 'm4a';
  if (mime.startsWith('audio/wav')) return 'wav';
  return 'webm';
}

/** Identifiant de prise : ne garde que ce qui peut entrer dans un nom de fichier. */
export function nettoyerIdPrise(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim().replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
  return id.length >= 8 ? id : null;
}

export function cheminPrise(agencyId: string, noteId: string, priseId: string, mime: string): string {
  return `${agencyId}/${noteId}.prise-${priseId}.${extensionAudio(mime)}`;
}

function estNoteTapee(storagePath: string | null | undefined): boolean {
  return !storagePath || storagePath.endsWith('.typed');
}

/** Toutes les prises d'une note, la première d'abord. */
export async function prisesAudio(
  admin: Client,
  agencyId: string,
  noteId: string,
  storagePath: string | null | undefined,
): Promise<PriseAudio[]> {
  if (estNoteTapee(storagePath)) return [];
  const prises: PriseAudio[] = [{ path: storagePath!, createdAt: null }];
  const { data, error } = await admin.storage
    .from(VOICE_BUCKET)
    .list(agencyId, { search: `${noteId}.prise-`, limit: 100 });
  if (error) {
    console.error('[voice] liste des prises', error.message);
    return prises;
  }
  const suivantes = (data ?? [])
    .filter((o) => o.name.startsWith(`${noteId}.prise-`))
    .map((o) => ({ path: `${agencyId}/${o.name}`, createdAt: o.created_at ?? null }))
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  return [...prises, ...suivantes];
}

/** Efface tout l'audio d'une note. Rend le nombre de fichiers retirés. */
export async function supprimerAudioNote(
  admin: Client,
  agencyId: string,
  noteId: string,
  storagePath: string | null | undefined,
): Promise<number> {
  const prises = await prisesAudio(admin, agencyId, noteId, storagePath);
  if (prises.length === 0) return 0;
  const { error } = await admin.storage.from(VOICE_BUCKET).remove(prises.map((p) => p.path));
  if (error) {
    console.error('[voice] suppression audio', error.message);
    return 0;
  }
  return prises.length;
}
