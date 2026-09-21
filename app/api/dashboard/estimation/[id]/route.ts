import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { canSeeOwnedRecord, viewerFromProfile } from '@/lib/agency/visibility';
import { ESTIMATION_SELECT, mapEstimation } from '@/lib/estimation/objet';
import { isEtat } from '@/lib/estimation/cycle';
import { appliquerPatch } from '@/lib/estimation/patch';
import { parseRapportExclus } from '@/lib/rapport/genere/exclus';
import { syncLeadEtapeEstimation } from '@/lib/estimation/pipeline';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 });

  const session = await createSupabaseServerClient();
  const { data, error } = await session
    .from('agency_estimations')
    .select(ESTIMATION_SELECT)
    .eq('id', id)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'Estimation introuvable' }, { status: 404 });
  }

  const viewer = viewerFromProfile(profile);
  if (
    !canSeeOwnedRecord(viewer, {
      assignedTo: data.referent_id,
      createdBy: data.created_by,
    })
  ) {
    return NextResponse.json({ error: 'Estimation introuvable' }, { status: 404 });
  }

  return NextResponse.json({ estimation: mapEstimation(data) });
}

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

  const session = await createSupabaseServerClient();
  const { data: row, error: fetchErr } = await session
    .from('agency_estimations')
    .select(ESTIMATION_SELECT)
    .eq('id', id)
    .eq('agency_id', agency.id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Estimation introuvable' }, { status: 404 });
  }

  const viewer = viewerFromProfile(profile);
  if (
    !canSeeOwnedRecord(viewer, {
      assignedTo: row.referent_id,
      createdBy: row.created_by,
    })
  ) {
    return NextResponse.json({ error: 'Estimation introuvable' }, { status: 404 });
  }

  // Ancien contrat : ajustement négociateur seul.
  if (body.adjustmentPct !== undefined && Object.keys(body).every((k) =>
    ['adjustmentPct', 'justification', 'agentValue', 'marketValue'].includes(k),
  )) {
    const pct = typeof body.adjustmentPct === 'number' ? body.adjustmentPct : Number(body.adjustmentPct);
    if (!Number.isFinite(pct) || pct < -15 || pct > 15) {
      return NextResponse.json({ error: 'Correction hors plage (−15 % à +15 %)' }, { status: 400 });
    }
    const justification = typeof body.justification === 'string' ? body.justification.trim() : '';
    if (Math.abs(pct) > 5 && justification.length < 3) {
      return NextResponse.json({ error: 'Une justification est requise au-delà de 5 %' }, { status: 400 });
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
        marketValue:
          typeof body.marketValue === 'number' ? body.marketValue : row.price_value,
        agentValue: typeof body.agentValue === 'number' ? body.agentValue : row.price_value,
      },
    };
    const { error } = await session
      .from('agency_estimations')
      .update({ context })
      .eq('id', id)
      .eq('agency_id', agency.id);
    if (error) return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
    return NextResponse.json({ ok: true, context });
  }

  const { patch, etat, error: patchError } = appliquerPatch(body, viewer);
  if (patchError) {
    return NextResponse.json({ error: patchError }, { status: 400 });
  }
  if (body.rapportExclus !== undefined || typeof body.remarquesExpert === 'string') {
    const prev =
      row.context && typeof row.context === 'object' && !Array.isArray(row.context)
        ? (row.context as Record<string, unknown>)
        : {};
    const deja =
      patch.context && typeof patch.context === 'object' && !Array.isArray(patch.context)
        ? (patch.context as Record<string, unknown>)
        : {};
    const next = { ...prev, ...deja };
    if (body.rapportExclus !== undefined) {
      next.rapportExclus = parseRapportExclus(body.rapportExclus);
    }
    if (typeof body.remarquesExpert === 'string') {
      next.remarquesExpert = body.remarquesExpert.trim() || null;
    }
    patch.context = next;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ estimation: mapEstimation(row) });
  }

  const { data: updated, error } = await session
    .from('agency_estimations')
    .update(patch)
    .eq('id', id)
    .eq('agency_id', agency.id)
    .select(ESTIMATION_SELECT)
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: 'Enregistrement impossible' }, { status: 500 });
  }

  await syncLeadEtapeEstimation({
    supabase: session,
    agencyId: agency.id,
    leadId: updated.lead_id,
    etat: etat ?? (isEtat(updated.etat) ? updated.etat : 'brouillon'),
  });

  return NextResponse.json({ estimation: mapEstimation(updated) });
}
