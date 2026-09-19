import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { estNextResponse, sessionRapportEstimation } from '@/lib/rapport/acces';
import { identiteAgenceDepuisRow, identiteAgentDepuisProfil, piedBienDepuisEstimation } from '@/lib/rapport/depuis-session';
import { mapPageComposee } from '@/lib/rapport/pages';
import { signerCheminRapport } from '@/lib/rapport/storage';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await sessionRapportEstimation(id);
  if (estNextResponse(ctx)) return ctx;

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('estimation_rapport_pages')
    .select('*')
    .eq('estimation_id', ctx.estimation.id)
    .eq('agency_id', ctx.agency.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Composition indisponible' }, { status: 500 });
  }

  const pages = await Promise.all(
    (data ?? []).map(async (row) =>
      mapPageComposee(row, row.storage_path ? await signerCheminRapport(row.storage_path) : null),
    ),
  );

  const [agence, agent] = await Promise.all([
    identiteAgenceDepuisRow(ctx.agency),
    Promise.resolve(identiteAgentDepuisProfil(ctx.profile, ctx.user.email)),
  ]);

  return NextResponse.json({
    pages,
    agence,
    agent,
    bien: piedBienDepuisEstimation(ctx.estimation),
    dateIso: ctx.estimation.updatedAt,
  });
}
