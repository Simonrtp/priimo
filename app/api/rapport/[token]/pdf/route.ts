import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';
import { telechargerRapport } from '@/lib/rapport/storage';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 });
  }

  const limit = rateLimit(`rapport-public-pdf:${clientIpFromRequest(req)}`, {
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return NextResponse.json({ error: 'Trop de téléchargements' }, { status: 429 });

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from('estimation_rapport_envois')
    .select('pdf_path, bien_label')
    .eq('token', token)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 });
  }

  const fichier = await telechargerRapport(row.pdf_path);
  if (!fichier) {
    return NextResponse.json({ error: 'Document indisponible' }, { status: 404 });
  }

  const nom = row.bien_label?.trim()
    ? `avis-de-valeur-${row.bien_label.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 48)}.pdf`
    : 'avis-de-valeur.pdf';

  return new NextResponse(Buffer.from(fichier.bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${nom}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
