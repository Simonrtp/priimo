import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { mapLeadStage } from '@/lib/queries/lead-stages';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { LeadStageRow } from '@/types/database';

export const runtime = 'nodejs';

function normalizeLabel(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeColor(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== 'string') return '';
  const color = value.trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '';
}

export async function PATCH(request: Request, ctx: { params: Promise<{ stageId: string }> }) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;

  const { stageId } = await ctx.params;
  if (!stageId) {
    return NextResponse.json({ error: 'Colonne inconnue' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const libelle = normalizeLabel(body.libelle);
  const accentColor = normalizeColor(body.accentColor);

  if (libelle !== null && libelle.length < 2) {
    return NextResponse.json({ error: 'Nom de colonne trop court' }, { status: 400 });
  }
  if (accentColor !== null && accentColor.length === 0) {
    return NextResponse.json({ error: 'Couleur invalide' }, { status: 400 });
  }

  const update: { libelle?: string; accent_color?: string } = {};
  if (libelle !== null) update.libelle = libelle;
  if (accentColor !== null) update.accent_color = accentColor;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucune modification' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('lead_stages')
    .update(update)
    .eq('id', stageId)
    .eq('agency_id', guard.agency.id)
    .select('id, agency_id, cle, libelle, ordre, accent_color, type, created_at')
    .single();

  if (error || !data) {
    console.error('[lead_stages] mise à jour', error);
    return NextResponse.json({ error: "La colonne n'a pas pu être mise à jour" }, { status: 500 });
  }

  return NextResponse.json({ stage: mapLeadStage(data as LeadStageRow) });
}
