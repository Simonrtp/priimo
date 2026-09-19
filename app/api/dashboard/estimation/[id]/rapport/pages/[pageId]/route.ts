import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { estNextResponse, sessionRapportEstimation } from '@/lib/rapport/acces';
import { supprimerRapport } from '@/lib/rapport/storage';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; pageId: string }> },
) {
  const { id, pageId } = await params;
  const ctx = await sessionRapportEstimation(id);
  if (estNextResponse(ctx)) return ctx;
  if (!pageId) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });

  const session = await createSupabaseServerClient();
  const { data } = await session
    .from('estimation_rapport_pages')
    .select('id, source, storage_path')
    .eq('id', pageId)
    .eq('estimation_id', ctx.estimation.id)
    .eq('agency_id', ctx.agency.id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: 'Page introuvable' }, { status: 404 });

  const { error } = await session
    .from('estimation_rapport_pages')
    .delete()
    .eq('id', pageId)
    .eq('estimation_id', ctx.estimation.id);
  if (error) return NextResponse.json({ error: 'Retrait impossible' }, { status: 500 });

  if (data.source === 'import' && data.storage_path) {
    const { count } = await session
      .from('estimation_rapport_pages')
      .select('id', { count: 'exact', head: true })
      .eq('storage_path', data.storage_path);
    if (!count) await supprimerRapport(data.storage_path);
  }

  return NextResponse.json({ ok: true });
}
