import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { normalizeParcelleId } from '@/lib/carte/parcelle-id';
import { parcelleDeLAdresse } from '@/lib/notes/parcelle-depuis-ban';
import { BAN_LIEN_CERTAIN } from '@/lib/notes/match';

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

export async function linkNoteToImmeuble(
  admin: Admin,
  args: { agencyId: string; noteId: string; banId: string },
): Promise<void> {
  const banId = args.banId.trim();
  if (!banId || banId.startsWith('gps:')) return;
  const { error } = await admin.from('note_liens').upsert(
    {
      note_id: args.noteId,
      agency_id: args.agencyId,
      entite_type: 'immeuble',
      entite_id: banId,
      confiance: 'certain',
      cree_par: 'agent',
    },
    { onConflict: 'note_id,entite_type,entite_id' },
  );
  if (error) console.error('[notes] lien immeuble', error);
}

/**
 * Un bien / une adresse BAN rattache aussi la note à la parcelle du volet
 * carte — sinon la note n’apparaît que sur la fiche bien.
 */
export async function propagerLienVersParcelle(
  admin: Admin,
  args: {
    agencyId: string;
    noteId: string;
    entiteType: 'bien' | 'immeuble' | 'parcelle';
    entiteId: string;
  },
): Promise<void> {
  if (args.entiteType === 'parcelle') {
    await linkNoteToParcelle(admin, {
      agencyId: args.agencyId,
      noteId: args.noteId,
      parcelleId: args.entiteId,
    });
    return;
  }

  let banId: string | null = null;
  if (args.entiteType === 'immeuble') {
    banId = args.entiteId.trim() || null;
  } else {
    const { data: bien } = await admin
      .from('biens')
      .select('ban_id')
      .eq('id', args.entiteId)
      .eq('agency_id', args.agencyId)
      .maybeSingle();
    banId = typeof bien?.ban_id === 'string' ? bien.ban_id : null;
    if (banId) {
      await linkNoteToImmeuble(admin, {
        agencyId: args.agencyId,
        noteId: args.noteId,
        banId,
      });
      // La note porte l’adresse : le volet parcelle la retrouve aussi via BAN.
      await admin
        .from('voice_notes')
        .update({ ban_id: banId })
        .eq('id', args.noteId)
        .eq('agency_id', args.agencyId)
        .is('ban_id', null);
    }
  }

  const parcelleId = banId ? await parcelleDeLAdresse(admin, { banId }) : null;
  if (parcelleId) {
    await linkNoteToParcelle(admin, {
      agencyId: args.agencyId,
      noteId: args.noteId,
      parcelleId,
    });
  }
}

/** L'adresse posée sur la note devient un rattachement (immeuble, puis parcelle) : la carte la retrouve. */
export async function rattacherAdresseDeLaNote(
  admin: Admin,
  args: { agencyId: string; noteId: string },
): Promise<void> {
  const { data: note } = await admin
    .from('voice_notes')
    .select('ban_id, geocode_score')
    .eq('id', args.noteId)
    .eq('agency_id', args.agencyId)
    .maybeSingle();
  const banId = typeof note?.ban_id === 'string' ? note.ban_id.trim() : '';
  if (!banId || banId.startsWith('gps:')) return;
  // Une adresse devinée de loin ne s'impose pas : l'agent la relie lui-même s'il le veut.
  if (typeof note?.geocode_score === 'number' && note.geocode_score < BAN_LIEN_CERTAIN) return;
  await linkNoteToImmeuble(admin, { agencyId: args.agencyId, noteId: args.noteId, banId });
  await propagerLienVersParcelle(admin, {
    agencyId: args.agencyId,
    noteId: args.noteId,
    entiteType: 'immeuble',
    entiteId: banId,
  });
}
