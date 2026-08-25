import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { NoteLienConfiance, NoteLienCreePar, NoteLienEntite } from '@/types/contact';
import { mapDbNoteLien } from '@/lib/notes/liens';
import type { NoteLienRow } from '@/types/database';

export const runtime = 'nodejs';

const TYPES: readonly NoteLienEntite[] = ['contact', 'bien', 'lead', 'immeuble', 'parcelle'];
const CONFIANCE: readonly NoteLienConfiance[] = ['certain', 'probable'];
const CREES: readonly NoteLienCreePar[] = ['agent', 'extraction', 'reconciliation'];

export async function POST(req: Request, ctx: { params: Promise<{ voiceNoteId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { voiceNoteId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const entiteType =
    typeof body.entiteType === 'string' && (TYPES as readonly string[]).includes(body.entiteType)
      ? (body.entiteType as NoteLienEntite)
      : null;
  const entiteId = typeof body.entiteId === 'string' ? body.entiteId.trim() : '';
  const confiance =
    typeof body.confiance === 'string' && (CONFIANCE as readonly string[]).includes(body.confiance)
      ? (body.confiance as NoteLienConfiance)
      : 'certain';
  const creePar =
    typeof body.creePar === 'string' && (CREES as readonly string[]).includes(body.creePar)
      ? (body.creePar as NoteLienCreePar)
      : 'agent';

  if (!entiteType || !entiteId) {
    return NextResponse.json({ error: 'Rattachement incomplet' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: note } = await admin
    .from('voice_notes')
    .select('id, agency_id, created_by')
    .eq('id', voiceNoteId)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (!note || note.created_by !== profile.id) {
    return NextResponse.json({ error: 'Dictée introuvable' }, { status: 404 });
  }

  const { data, error } = await admin
    .from('note_liens')
    .upsert(
      {
        note_id: voiceNoteId,
        agency_id: agency.id,
        entite_type: entiteType,
        entite_id: entiteId,
        confiance,
        cree_par: creePar,
      },
      { onConflict: 'note_id,entite_type,entite_id' },
    )
    .select('id, note_id, agency_id, entite_type, entite_id, confiance, cree_par, cree_le')
    .single();

  if (error || !data) {
    console.error('[notes] lien', error);
    return NextResponse.json({ error: "Le rattachement n'a pas pu être enregistré" }, { status: 500 });
  }

  if (entiteType === 'contact') {
    await admin
      .from('voice_notes')
      .update({ contact_id: entiteId })
      .eq('id', voiceNoteId)
      .eq('agency_id', agency.id);
  }

  return NextResponse.json({ lien: mapDbNoteLien(data as NoteLienRow) }, { status: 201 });
}
