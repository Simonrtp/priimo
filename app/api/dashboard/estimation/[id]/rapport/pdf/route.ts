import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { estNextResponse, sessionRapportEstimation } from '@/lib/rapport/acces';
import { piedBienDepuisEstimation } from '@/lib/rapport/depuis-session';
import { assemblerRapport } from '@/lib/rapport/genere/assembler';
import { genererPdfRapport } from '@/lib/rapport/pdf';
import { pageExportable } from '@/lib/rapport/pages';

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
  let assemble;
  try {
    assemble = await assemblerRapport(session, ctx, { signer: false });
  } catch {
    return NextResponse.json({ error: 'Composition indisponible' }, { status: 500 });
  }
  const pages = assemble.pages.filter(pageExportable);
  if (pages.length === 0) {
    return NextResponse.json({ error: 'Ajoutez au moins une page au rapport' }, { status: 400 });
  }

  const pdf = await genererPdfRapport({
    agence: assemble.agence,
    agent: assemble.agent,
    bien: piedBienDepuisEstimation(ctx.estimation),
    dateIso: ctx.estimation.updatedAt,
    pages,
    dossier: assemble.dossier,
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
