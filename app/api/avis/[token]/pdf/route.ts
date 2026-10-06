import { NextResponse } from 'next/server';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { assemblerAvisPublic } from '@/lib/rapport/avis-public';
import { piedBienDepuisEstimation } from '@/lib/rapport/depuis-session';
import { genererPdfRapport } from '@/lib/rapport/pdf';
import { pagePourPdf } from '@/lib/rapport/pages';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const limit = rateLimit(`avis-public-pdf:${clientIpFromRequest(req)}`, {
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return NextResponse.json({ error: 'Trop de téléchargements' }, { status: 429 });

  const result = await assemblerAvisPublic(token, { compterVue: false });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const pages = result.data.pages.filter(pagePourPdf);
  if (pages.length === 0) {
    return NextResponse.json({ error: 'Document indisponible' }, { status: 400 });
  }

  let pdf: Uint8Array;
  try {
    pdf = await genererPdfRapport({
      agence: result.data.agence,
      agent: result.data.agent,
      bien: piedBienDepuisEstimation(result.data.estimation),
      dateIso: result.data.estimation.updatedAt,
      pages,
      dossier: result.data.dossier,
    });
  } catch (err) {
    console.error('[avis/pdf]', err);
    return NextResponse.json({ error: 'Téléchargement interrompu' }, { status: 500 });
  }

  const nom = result.data.estimation.address?.trim()
    ? `avis-de-valeur-${result.data.estimation.address.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 48)}.pdf`
    : 'avis-de-valeur.pdf';

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nom}"`,
      'Cache-Control': 'no-store',
    },
  });
}
