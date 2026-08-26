import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';

type Admin = SupabaseClient<Database>;

export async function linkNoteToParcelle(
  admin: Admin,
  args: { agencyId: string; noteId: string; parcelleId: string },
): Promise<void> {
  const parcelleId = normalizeParcelleId(args.parcelleId);
  if (!parcelleId) return;
  const { error } = await admin.from('note_liens').upsert(
    {
      note_id: args.noteId,
      agency_id: args.agencyId,
      entite_type: 'parcelle',
      entite_id: parcelleId,
      confiance: 'certain',
      cree_par: 'agent',
    },
    { onConflict: 'note_id,entite_type,entite_id' },
  );
  if (error) console.error('[notes] lien parcelle', error);
}
