import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { lireConfigAbonnement } from '@/lib/billing/config';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agencyId: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { agencyId } = await params;
  let body: { decision?: unknown; notes?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const decision = body.decision === 'refusee' ? 'refusee' : body.decision === 'acceptee' ? 'acceptee' : null;
  if (!decision) {
    return NextResponse.json({ error: 'Décision invalide.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: agency, error: loadErr } = await admin
    .from('agencies')
    .select('id, demande_decision')
    .eq('id', agencyId)
    .maybeSingle();
  if (loadErr || !agency) {
    return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
  }

  const now = new Date();
  const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
  const config = lireConfigAbonnement();

  const patch =
    decision === 'acceptee'
      ? {
          demande_decision: 'acceptee' as const,
          demande_decidee_le: now.toISOString(),
          demande_notes: notes,
          statut_abonnement: 'essai' as const,
          essai_fin_le: new Date(now.getTime() + config.essaiJours * 86_400_000).toISOString(),
          sieges_inclus: config.siegesInclus,
          prix_base: config.prixBase,
          prix_siege_supplementaire: config.prixSiege,
        }
      : {
          demande_decision: 'refusee' as const,
          demande_decidee_le: now.toISOString(),
          demande_notes: notes,
          statut_abonnement: 'en_attente' as const,
        };

  const { error } = await admin.from('agencies').update(patch).eq('id', agencyId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
