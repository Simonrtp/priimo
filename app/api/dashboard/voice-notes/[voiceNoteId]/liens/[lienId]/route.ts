import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ voiceNoteId: string; lienId: string }> },
) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { voiceNoteId, lienId } = await ctx.params;
  const admin = createSupabaseAdminClient();

  const { data: lien } = await admin
    .from('note_liens')
    .select('id, note_id, agency_id, cree_par')
    .eq('id', lienId)
    .eq('note_id', voiceNoteId)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (!lien) return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 });

  const { error } = await admin
    .from('note_liens')
    .delete()
    .eq('id', lienId)
    .eq('agency_id', agency.id);

  if (error) {
    console.error('[notes] rejet lien', error);
    return NextResponse.json({ error: "Le rattachement n'a pas pu être retiré" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ voiceNoteId: string; lienId: string }> },
) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { voiceNoteId, lienId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  if (body.confirmer !== true) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('note_liens')
    .update({ confiance: 'certain', cree_par: 'agent' })
    .eq('id', lienId)
    .eq('note_id', voiceNoteId)
    .eq('agency_id', agency.id);

  if (error) {
    console.error('[notes] confirmer lien', error);
    return NextResponse.json({ error: "Le rattachement n'a pas pu être confirmé" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
