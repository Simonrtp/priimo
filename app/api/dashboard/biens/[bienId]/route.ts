import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { bienFieldsToRow, parseBienInput } from '@/lib/bien-input';
import { geocodeToColumns } from '@/lib/geo/fields';
import { BIENS_SELECT, mapDbBienToBien } from '@/lib/queries/biens';
import type { BienRow } from '@/types/database';

export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: { params: Promise<{ bienId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { bienId } = await ctx.params;
  if (!bienId) return NextResponse.json({ error: 'Bien inconnu' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const parsed = parseBienInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const f = parsed.fields;
  const geo = await geocodeToColumns(f.address, f.postalCode);

  const supabase = await createSupabaseServerClient();
  // Le filtre sur `agency_id` double la politique RLS : une erreur de configuration
  // côté base ne doit pas suffire à laisser modifier le bien d'une autre agence.
  const { data, error } = await supabase
    .from('biens')
    .update({ ...bienFieldsToRow(f), ...geo })
    .eq('id', bienId)
    .eq('agency_id', agency.id)
    .select(BIENS_SELECT)
    .single();

  if (error || !data) {
    console.error('[biens] mise à jour', error);
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ bien: mapDbBienToBien(data as unknown as BienRow) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ bienId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { bienId } = await ctx.params;
  if (!bienId) return NextResponse.json({ error: 'Bien inconnu' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('biens')
    .delete()
    .eq('id', bienId)
    .eq('agency_id', agency.id);

  if (error) {
    console.error('[biens] suppression', error);
    return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
