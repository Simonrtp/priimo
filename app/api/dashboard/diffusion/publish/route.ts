import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { bienToAnnonce } from '@/lib/diffusion/from-bien';
import { publierAnnonce } from '@/lib/diffusion/publish';
import type { PortailId } from '@/lib/diffusion/types';
import { PORTAIL_LABELS } from '@/lib/diffusion/types';
import { mapDbBienToBien, BIENS_SELECT } from '@/lib/queries/biens';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const PORTAILS = Object.keys(PORTAIL_LABELS) as PortailId[];

/**
 * Publie un bien sur un portail via la passerelle (Ubiflow / Diffuze / noop).
 * Valide AVANT envoi. Idempotent.
 */
export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: { bienId?: string; portail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const bienId = typeof body.bienId === 'string' ? body.bienId : '';
  const portail = typeof body.portail === 'string' ? body.portail : '';
  if (!bienId || !(PORTAILS as string[]).includes(portail)) {
    return NextResponse.json({ error: 'bienId et portail requis' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from('biens')
    .select(BIENS_SELECT)
    .eq('id', bienId)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
  }

  const bien = mapDbBienToBien(row as never);
  const annonce = bienToAnnonce(bien, agency.name ?? null);
  const outcome = await publierAnnonce({
    admin,
    agencyId: agency.id,
    bienId,
    portail: portail as PortailId,
    annonce,
  });

  if (!outcome.ok) {
    return NextResponse.json(outcome, { status: outcome.reason === 'validation' ? 422 : 502 });
  }
  return NextResponse.json(outcome);
}
