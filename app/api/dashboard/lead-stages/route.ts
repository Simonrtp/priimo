import { NextResponse } from 'next/server';
import { requireDirector } from '@/lib/auth/requireDirector';
import { mapLeadStage } from '@/lib/queries/lead-stages';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { LeadStageRow } from '@/types/database';

export const runtime = 'nodejs';

function normalizeLabel(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
}

function slugifyStageKey(label: string): string {
  const slug = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'etape';
}

export async function POST(request: Request) {
  const guard = await requireDirector();
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const libelle = normalizeLabel(body.libelle);
  if (libelle.length < 2) {
    return NextResponse.json({ error: 'Nom de colonne trop court' }, { status: 400 });
  }

  const accentColor = isHexColor(body.accentColor) ? body.accentColor.trim() : null;
  if (!accentColor) {
    return NextResponse.json({ error: 'Couleur invalide' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: loadError } = await supabase
    .from('lead_stages')
    .select('cle, ordre')
    .eq('agency_id', guard.agency.id)
    .order('ordre', { ascending: true });

  if (loadError) {
    return NextResponse.json({ error: 'Impossible de charger les colonnes' }, { status: 500 });
  }

  const keys = new Set((existing ?? []).map((row) => row.cle));
  const baseKey = slugifyStageKey(libelle);
  let cle = baseKey;
  let suffix = 2;
  while (keys.has(cle)) {
    cle = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  const ordre = (existing ?? []).reduce((max, row) => Math.max(max, row.ordre), 0) + 1;

  const { data, error } = await supabase
    .from('lead_stages')
    .insert({
      agency_id: guard.agency.id,
      cle,
      libelle,
      ordre,
      accent_color: accentColor,
      type: 'intermediaire',
    })
    .select('id, agency_id, cle, libelle, ordre, accent_color, type, created_at')
    .single();

  if (error || !data) {
    console.error('[lead_stages] création', error);
    return NextResponse.json({ error: "La colonne n'a pas pu être créée" }, { status: 500 });
  }

  return NextResponse.json({ stage: mapLeadStage(data as LeadStageRow) }, { status: 201 });
}
