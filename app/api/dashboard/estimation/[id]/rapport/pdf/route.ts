import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { estNextResponse, sessionRapportEstimation } from '@/lib/rapport/acces';
import { identiteAgenceDepuisRow, identiteAgentDepuisProfil, piedBienDepuisEstimation } from '@/lib/rapport/depuis-session';
import { mapPageComposee } from '@/lib/rapport/pages';
import { genererPdfRapport } from '@/lib/rapport/pdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await sessionRapportEstimation(id);
  if (estNextResponse(ctx)) return ctx;

  const limit = rateLimit(`rapport-pdf:${clientIpFromRequest(req)}`, {
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return NextResponse.json({ error: 'Trop d’exports' }, { status: 429 });

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

  const pages = (data ?? []).map((row) => mapPageComposee(row, null));
  const pdf = await genererPdfRapport({
    agence: await identiteAgenceDepuisRow(ctx.agency),
    agent: identiteAgentDepuisProfil(ctx.profile, ctx.user.email),
    bien: piedBienDepuisEstimation(ctx.estimation),
    dateIso: ctx.estimation.updatedAt,
    pages,
  });

  const nom = ctx.estimation.address?.trim()
    ? `avis-de-valeur-${ctx.estimation.address.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 48)}.pdf`
    : 'avis-de-valeur.pdf';

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nom}"`,
      'Cache-Control': 'no-store',
    },
  });
}
