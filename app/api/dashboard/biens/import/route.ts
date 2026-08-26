import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { bienFieldsToRow } from '@/lib/bien-input';
import { createBanGeocodeCache } from '@/lib/geo/ban';
import { geocodeToColumns } from '@/lib/geo/fields';
import { BIENS_SELECT, biensSelectWithOwner, mapDbBienToBien } from '@/lib/queries/biens';
import { activeMappedKeys } from '@/lib/import/mapping';
import {
  BIEN_IMPORT_FIELDS,
  bienToDuplicateRef,
  bienToInput,
  mergeBienFields,
  planBienImport,
  type DuplicateStrategy,
} from '@/lib/import/biens';
import { MAX_IMPORT_ROWS } from '@/lib/import/limits';
import type { Bien } from '@/types/bien';
import type { BienRow } from '@/types/database';

export const runtime = 'nodejs';

const FIELD_KEYS = new Set(BIEN_IMPORT_FIELDS.map((f) => f.key));

function sanitizeRows(raw: unknown): { line: number; mapped: Record<string, string> }[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_IMPORT_ROWS).flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    const line = Number(row.line);
    if (!Number.isInteger(line) || line < 2) return [];
    const mappedRaw = row.mapped;
    if (typeof mappedRaw !== 'object' || mappedRaw === null) return [];
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(mappedRaw as Record<string, unknown>)) {
      if (!FIELD_KEYS.has(key)) continue;
      mapped[key] = typeof value === 'string' ? value.slice(0, 8000) : '';
    }
    return [{ line, mapped }];
  });
}

function sanitizeMapping(raw: unknown): Record<string, string> {
  const mapping: Record<string, string> = {};
  const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  for (const field of BIEN_IMPORT_FIELDS) {
    const value = src[field.key];
    mapping[field.key] = typeof value === 'string' ? value : '';
  }
  return mapping;
}

export async function POST(req: Request) {
  const { user, profile, agency } = await getServerUser();
  if (!user || !profile || !agency) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const payload = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const rows = sanitizeRows(payload.rows);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne à importer' }, { status: 400 });
  }
  const strategy: DuplicateStrategy = payload.duplicates === 'update' ? 'update' : 'ignore';
  const mapping = sanitizeMapping(payload.mapping);
  const keys = activeMappedKeys(mapping);

  const supabase = await createSupabaseServerClient();
  const { data: existingRows, error: loadError } = await supabase.from('biens').select(biensSelectWithOwner(BIENS_SELECT));

  if (loadError) {
    console.error('[biens/import] lecture', loadError);
    return NextResponse.json({ error: 'Lecture des biens impossible' }, { status: 500 });
  }

  const existing = ((existingRows ?? []) as unknown as BienRow[]).map(mapDbBienToBien);
  const byId = new Map(existing.map((b) => [b.id, b]));
  const plan = planBienImport(rows, existing.map(bienToDuplicateRef), strategy);
  const cache = createBanGeocodeCache();

  const created: Bien[] = [];
  const updated: Bien[] = [];
  const skipped: { line: number; reason: string }[] = [];

  for (const item of plan) {
    if (item.action === 'skip') {
      skipped.push({ line: item.line, reason: item.reason });
      continue;
    }

    if (item.action === 'create') {
      const geo = await geocodeToColumns(item.fields.address, item.fields.postalCode, cache);
      const { data, error } = await supabase
        .from('biens')
        .insert({
          agency_id: agency.id,
          created_by: profile.id,
          ...bienFieldsToRow(item.fields),
          ...geo,
        })
        .select(biensSelectWithOwner(BIENS_SELECT))
        .single();
      if (error || !data) {
        console.error('[biens/import] création', error);
        skipped.push({ line: item.line, reason: 'Écriture impossible' });
        continue;
      }
      created.push(mapDbBienToBien(data as unknown as BienRow));
      continue;
    }

    const current = byId.get(item.duplicate.id);
    if (!current) {
      skipped.push({ line: item.line, reason: 'Fiche introuvable' });
      continue;
    }
    const merged = mergeBienFields(bienToInput(current), item.fields, keys);
    const geo = await geocodeToColumns(merged.address, merged.postalCode, cache);
    const { data, error } = await supabase
      .from('biens')
      .update({ ...bienFieldsToRow(merged), ...geo })
      .eq('id', item.duplicate.id)
      .eq('agency_id', agency.id)
      .select(biensSelectWithOwner(BIENS_SELECT))
      .single();
    if (error || !data) {
      console.error('[biens/import] mise à jour', error);
      skipped.push({ line: item.line, reason: 'Mise à jour impossible' });
      continue;
    }
    const bien = mapDbBienToBien(data as unknown as BienRow);
    byId.set(bien.id, bien);
    updated.push(bien);
  }

  return NextResponse.json({ created, updated, skipped });
}
