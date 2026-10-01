/**
 * Rappels et tâches dictés → promesses, c'est-à-dire des cartes sur l'accueil
 * de l'agent (« Rappeler Janine » avec le bouton d'appel).
 *
 * Rejouable : une promesse déjà créée pour cette note et cet intitulé n'est
 * pas recréée — valider deux fois, ou valider après la lecture automatique,
 * ne double rien.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { heureLisible } from '@/lib/voice/cartes';

type Client = SupabaseClient<Database>;

export type RappelACreer = {
  intitule: string;
  /** « AAAA-MM-JJ ». */
  date: string;
  heure: string | null;
  contactId: string | null;
  profileId: string;
};

/** « Rappeler Janine » dicté « jeudi 14h » → « Rappeler Janine · 14h ». */
export function libelleRappel(intitule: string, heure: string | null): string {
  return (heure ? `${intitule} · ${heureLisible(heure)}` : intitule).slice(0, 200);
}

/** Rend `true` si une promesse a été créée, `false` si elle existait déjà. */
export async function enregistrerRappel(
  admin: Client,
  agencyId: string,
  noteId: string,
  r: RappelACreer,
): Promise<boolean> {
  const intitule = libelleRappel(r.intitule, r.heure);
  const { data: deja } = await admin
    .from('promesses')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('note_id', noteId)
    .eq('intitule', intitule)
    .maybeSingle();
  if (deja) return false;
  const { error } = await admin.from('promesses').insert({
    agency_id: agencyId,
    profile_id: r.profileId,
    contact_id: r.contactId,
    note_id: noteId,
    intitule,
    echeance: r.date,
    statut: 'a_faire',
    cree_par: 'dictee',
  });
  if (error) throw new Error(error.message);
  return true;
}
