import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { colonneVoisine } from '@/lib/pipeline/colonne';
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
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

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
    .eq('agency_id', agency.id)
    .select('id, agency_id, cle, libelle, ordre, accent_color, type, created_at')
    .single();

  if (error || !data) {
    console.error('[lead_stages] mise à jour', error);
    return NextResponse.json({ error: "La colonne n'a pas pu être mise à jour" }, { status: 500 });
  }

  return NextResponse.json({ stage: mapLeadStage(data as LeadStageRow) });
}

/** Retire une colonne. Les cartes passent dans la colonne d'avant. Pris reste. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ stageId: string }> }) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { stageId } = await ctx.params;
  if (!stageId) return NextResponse.json({ error: 'Colonne inconnue' }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: lignes, error: errLignes } = await supabase
    .from('lead_stages')
    .select('id, libelle, ordre, type')
    .eq('agency_id', agency.id);

  if (errLignes || !lignes) {
    return NextResponse.json({ error: 'Impossible de charger les colonnes' }, { status: 500 });
  }

  const colonne = lignes.find((ligne) => ligne.id === stageId);
  if (!colonne) return NextResponse.json({ error: 'Colonne introuvable' }, { status: 404 });
  if (colonne.type === 'entree') {
    return NextResponse.json(
      { error: 'La colonne d’entrée reste : c’est là que les leads arrivent.' },
      { status: 409 },
    );
  }

  const destination = colonneVoisine(
    colonne,
    lignes.filter((ligne) => ligne.id !== stageId),
  );
  if (!destination) {
    return NextResponse.json({ error: 'Il faut garder au moins une colonne.' }, { status: 409 });
  }

  const { data: cartes, error: errCartes } = await supabase
    .from('leads')
    .select('id, stage_position')
    .eq('agency_id', agency.id)
    .eq('stage_id', stageId)
    .order('stage_position', { ascending: true });

  if (errCartes) {
    return NextResponse.json({ error: "Les cartes n'ont pas pu être déplacées" }, { status: 500 });
  }

  const { data: fin } = await supabase
    .from('leads')
    .select('stage_position')
    .eq('agency_id', agency.id)
    .eq('stage_id', destination.id)
    .order('stage_position', { ascending: false })
    .limit(1);

  const brut = fin?.[0]?.stage_position;
  const max = brut == null ? null : Number(brut);
  let position = max != null && Number.isFinite(max) ? max + 1 : 1000;
  const deplacees: { id: string; stagePosition: number }[] = [];

  for (const carte of cartes ?? []) {
    const { error: errCarte } = await supabase
      .from('leads')
      .update({ stage_id: destination.id, stage_position: position })
      .eq('id', carte.id)
      .eq('agency_id', agency.id);
    if (errCarte) {
      console.error('[lead_stages] déplacement', errCarte.message);
      return NextResponse.json({ error: "Les cartes n'ont pas pu être déplacées" }, { status: 500 });
    }
    deplacees.push({ id: carte.id, stagePosition: position });
    position += 1;
  }

  const { error: errSuppr } = await supabase
    .from('lead_stages')
    .delete()
    .eq('id', stageId)
    .eq('agency_id', agency.id);

  if (errSuppr) {
    console.error('[lead_stages] suppression', errSuppr.message);
    return NextResponse.json({ error: "La colonne n'a pas pu être supprimée" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    destination: { id: destination.id, libelle: destination.libelle },
    leads: deplacees,
  });
}
