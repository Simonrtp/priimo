import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
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
  const ids =
    typeof body === 'object' && body && 'ids' in body && Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string')
      : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Liste vide' }, { status: 400 });
  }

  const session = await createSupabaseServerClient();
  const updates = ids.map((id, position) =>
    session
      .from('agency_rapport_pages')
      .update({ position })
      .eq('id', id)
      .eq('agency_id', agency.id),
  );
  const results = await Promise.all(updates);
  if (results.some((r) => r.error)) {
    return NextResponse.json({ error: 'Réordonnancement impossible' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
