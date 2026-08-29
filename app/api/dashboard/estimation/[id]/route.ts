import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Met à jour l’ajustement négociateur sur une estimation déjà calculée.
 * Les deux valeurs (marché + avis agent) restent visibles sur l’avis partagé.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const pct = typeof body.adjustmentPct === 'number' ? body.adjustmentPct : Number(body.adjustmentPct);
  if (!Number.isFinite(pct) || pct < -15 || pct > 15) {
    return NextResponse.json({ error: 'Correction hors plage (−15 % à +15 %)' }, { status: 400 });
  }

  const justification =
    typeof body.justification === 'string' ? body.justification.trim() : '';
  if (Math.abs(pct) > 5 && justification.length < 3) {
    return NextResponse.json(
      { error: 'Une justification est requise au-delà de 5 %' },
      { status: 400 },
    );
  }

  const agentValue =
    typeof body.agentValue === 'number' && Number.isFinite(body.agentValue)
      ? Math.round(body.agentValue)
      : null;
  const marketValue =
    typeof body.marketValue === 'number' && Number.isFinite(body.marketValue)
      ? Math.round(body.marketValue)
      : null;

  const session = await createSupabaseServerClient();
  const { data: row, error: fetchErr } = await session
    .from('agency_estimations')
    .select('id, context, price_value')
    .eq('id', id)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Estimation introuvable' }, { status: 404 });
  }

  const prev =
    row.context && typeof row.context === 'object' && !Array.isArray(row.context)
      ? (row.context as Record<string, unknown>)
      : {};

  const context = {
    ...prev,
    agentAdjustment: {
      pct,
      justification: justification || null,
      marketValue: marketValue ?? row.price_value,
      agentValue: agentValue ?? row.price_value,
    },
  };

  const { error } = await session
    .from('agency_estimations')
    .update({ context })
    .eq('id', id)
    .eq('agency_id', agency.id);

  if (error) {
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, context });
}
