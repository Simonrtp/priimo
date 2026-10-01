/**
 * Effacement des dictées qui nomment un contact supprimé.
 *
 * Le déclencheur `purger_copies_contact` (20260921) efface la transcription des
 * notes dont `contact_id` pointe sur la fiche. Deux angles morts restaient :
 *   — l'audio dans le stockage, qu'un déclencheur SQL ne peut pas atteindre ;
 *   — les notes reliées par `note_liens` : `contact_id` ne garde que le dernier
 *     contact rattaché, une note qui nomme deux personnes gardait le texte de
 *     la première.
 *
 * À appeler AVANT de supprimer le contact : ensuite, plus rien ne dit quelles
 * notes le citaient. Comme le déclencheur, on retire ce qui nomme la personne
 * (voix, texte, champs extraits) ; la note, son adresse et son auteur restent.
 *
 * Un lien « probable » posé par la réconciliation automatique, jamais confirmé
 * par l'agent, n'est qu'une supposition : il n'efface rien.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { supprimerAudioNote } from '@/lib/voice/storage';

type Client = SupabaseClient<Database>;

export type BilanEffacement = { notes: number; fichiersAudio: number };

export async function effacerDicteesDuContact(
  admin: Client,
  agencyId: string,
  contactId: string,
): Promise<BilanEffacement> {
  const [liens, directes] = await Promise.all([
    admin
      .from('note_liens')
      .select('note_id, confiance, cree_par')
      .eq('agency_id', agencyId)
      .eq('entite_type', 'contact')
      .eq('entite_id', contactId),
    admin
      .from('voice_notes')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('contact_id', contactId),
  ]);
  if (liens.error) throw new Error(`note_liens: ${liens.error.message}`);
  if (directes.error) throw new Error(`voice_notes: ${directes.error.message}`);

  const ids = new Set<string>((directes.data ?? []).map((n) => n.id));
  for (const lien of (liens.data ?? []) as { note_id: string; confiance: string; cree_par: string }[]) {
    const supposition = lien.cree_par === 'reconciliation' && lien.confiance === 'probable';
    if (!supposition) ids.add(lien.note_id);
  }
  if (ids.size === 0) return { notes: 0, fichiersAudio: 0 };

  const { data: notes, error } = await admin
    .from('voice_notes')
    .select('id, storage_path')
    .eq('agency_id', agencyId)
    .in('id', [...ids]);
  if (error) throw new Error(`voice_notes: ${error.message}`);

  let fichiersAudio = 0;
  for (const note of notes ?? []) {
    fichiersAudio += await supprimerAudioNote(admin, agencyId, note.id, note.storage_path);
  }

  const effacement = {
    transcript: null,
    transcript_original: null,
    structured: {},
    source_info: null,
    texte_efface_le: new Date().toISOString(),
  };
  const noteIds = (notes ?? []).map((n) => n.id);
  let maj = await admin.from('voice_notes').update(effacement).eq('agency_id', agencyId).in('id', noteIds);
  if (maj.error) {
    // Base sans les colonnes récentes (20260834, 20260921) : on efface l'essentiel.
    const { transcript_original: _o, texte_efface_le: _e, ...essentiel } = effacement;
    maj = await admin.from('voice_notes').update(essentiel).eq('agency_id', agencyId).in('id', noteIds);
  }
  if (maj.error) throw new Error(`effacement: ${maj.error.message}`);

  return { notes: noteIds.length, fichiersAudio };
}
