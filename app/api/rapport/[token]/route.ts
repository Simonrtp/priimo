import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { clientIpFromRequest, rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 });
  }

  const limit = rateLimit(`rapport-public:${clientIpFromRequest(req)}`, {
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return NextResponse.json({ error: 'Trop de consultations' }, { status: 429 });

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from('estimation_rapport_envois')
    .select('id, version, bien_label, agence_nom, agent_nom, envoye_at, premier_vu_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: 'Lien introuvable' }, { status: 404 });
  }

  if (!row.premier_vu_at) {
    const now = new Date().toISOString();
    await admin
      .from('estimation_rapport_envois')
      .update({ premier_vu_at: now })
      .eq('id', row.id)
      .is('premier_vu_at', null);
    row.premier_vu_at = now;
  }

  return NextResponse.json({
    version: row.version,
    bienLabel: row.bien_label,
    agenceNom: row.agence_nom,
    agentNom: row.agent_nom,
    envoyeAt: row.envoye_at,
  });
}
