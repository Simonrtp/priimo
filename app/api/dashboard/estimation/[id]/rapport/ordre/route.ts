import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { estNextResponse, sessionRapportEstimation } from '@/lib/rapport/acces';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await sessionRapportEstimation(id);
  if (estNextResponse(ctx)) return ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const ids =
    typeof body === 'object' && body && 'ids' in body && Array.isArray(body.ids)
      ? body.ids.filter((x): x is string => typeof x === 'string')
      : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Liste vide' }, { status: 400 });
  }

  const session = await createSupabaseServerClient();
  const results = await Promise.all(
    ids.map((pageId, position) =>
      session
        .from('estimation_rapport_pages')
        .update({ position })
        .eq('id', pageId)
        .eq('estimation_id', ctx.estimation.id)
        .eq('agency_id', ctx.agency.id),
    ),
  );
  if (results.some((r) => r.error)) {
    return NextResponse.json({ error: 'Réordonnancement impossible' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
