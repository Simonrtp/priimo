import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { normalizeIdu } from '@/lib/carte/parcelle';

type Admin = SupabaseClient<Database>;

export async function linkNoteToParcelle(
  admin: Admin,
  args: { agencyId: string; noteId: string; idu: string },
): Promise<void> {
  const idu = normalizeIdu(args.idu);
  if (!idu) return;
  const { error } = await admin.from('note_liens').upsert(
    {
      note_id: args.noteId,
      agency_id: args.agencyId,
      entite_type: 'parcelle',
      entite_id: idu,
      confiance: 'certain',
      cree_par: 'agent',
    },
    { onConflict: 'note_id,entite_type,entite_id' },
  );
  if (error) console.error('[notes] lien parcelle', error);
}
