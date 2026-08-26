import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { bienFieldsToRow, parseBienInput } from '@/lib/bien-input';
import { geocodeToColumns } from '@/lib/geo/fields';
import { BIENS_SELECT, biensSelectWithOwner, mapDbBienToBien } from '@/lib/queries/biens';
import type { BienRow } from '@/types/database';
import { reconcileOrphanNotes } from '@/lib/notes/run-reconcile';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

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
  const { data, error } = await supabase
    .from('biens')
    .insert({
      agency_id: agency.id,
      created_by: profile.id,
      ...bienFieldsToRow(f),
      ...geo,
    })
    .select(biensSelectWithOwner(BIENS_SELECT))
    .single();

  if (error || !data) {
    console.error('[biens] création', error);
    return NextResponse.json({ error: "Le bien n'a pas pu être créé" }, { status: 500 });
  }

  const bien = mapDbBienToBien(data as unknown as BienRow);

  try {
    const admin = createSupabaseAdminClient();
    await reconcileOrphanNotes(admin, agency.id, {
      entiteType: 'bien',
      entiteId: bien.id,
      needles: [bien.address, bien.postalCode, bien.city],
    });
  } catch (err) {
    console.error('[biens] réconciliation', err);
  }

  return NextResponse.json({ bien }, { status: 201 });
}
