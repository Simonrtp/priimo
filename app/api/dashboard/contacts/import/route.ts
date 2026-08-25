import { NextResponse } from 'next/server';
import { getServerUser } from '@/lib/auth/getServerUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { contactFieldsToRow } from '@/lib/contact-input';
import { createBanGeocodeCache } from '@/lib/geo/ban';
import { contactGeocodeQuery, EMPTY_BAN_GEO, geocodeToColumns } from '@/lib/geo/fields';
import { CONTACTS_SELECT, mapDbContactToContact } from '@/lib/queries/contacts';
import { activeMappedKeys } from '@/lib/import/mapping';
import {
  CONTACT_IMPORT_FIELDS,
  contactToDuplicateRef,
  contactToInput,
  mergeContactFields,
  planContactImport,
  type DuplicateStrategy,
} from '@/lib/import/contacts';
import { MAX_IMPORT_ROWS } from '@/lib/import/limits';
import type { Contact } from '@/types/contact';
import type { ContactRow } from '@/types/database';

export const runtime = 'nodejs';

const FIELD_KEYS = new Set(CONTACT_IMPORT_FIELDS.map((f) => f.key));

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
  for (const field of CONTACT_IMPORT_FIELDS) {
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
  const { data: existingRows, error: loadError } = await supabase
    .from('contacts')
    .select(CONTACTS_SELECT);

  if (loadError) {
    console.error('[contacts/import] lecture', loadError);
    return NextResponse.json({ error: 'Lecture des contacts impossible' }, { status: 500 });
  }

  const existing = ((existingRows ?? []) as unknown as ContactRow[]).map(mapDbContactToContact);
  const byId = new Map(existing.map((c) => [c.id, c]));
  const plan = planContactImport(rows, existing.map(contactToDuplicateRef), strategy);
  const cache = createBanGeocodeCache();

  const created: Contact[] = [];
  const updated: Contact[] = [];
  const skipped: { line: number; reason: string }[] = [];

  for (const item of plan) {
    if (item.action === 'skip') {
      skipped.push({ line: item.line, reason: item.reason });
      continue;
    }

    if (item.action === 'create') {
      const query = contactGeocodeQuery(item.fields.address, item.fields.secteur, item.fields.postalCodes);
      const geo = query ? await geocodeToColumns(query.adresse, query.codePostal, cache) : {};
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          ...contactFieldsToRow(item.fields, {
            agencyId: agency.id,
            createdBy: profile.id,
            source: 'manuel',
          }),
          last_interaction_at: new Date().toISOString(),
          ...geo,
        })
        .select(CONTACTS_SELECT)
        .single();
      if (error || !data) {
        console.error('[contacts/import] création', error);
        skipped.push({ line: item.line, reason: 'Écriture impossible' });
        continue;
      }
      created.push(mapDbContactToContact(data as unknown as ContactRow));
      continue;
    }

    const current = byId.get(item.duplicate.id);
    if (!current) {
      skipped.push({ line: item.line, reason: 'Fiche introuvable' });
      continue;
    }
    const merged = mergeContactFields(contactToInput(current), item.fields, keys);
    const row = contactFieldsToRow(merged, {
      agencyId: agency.id,
      createdBy: profile.id,
      source: 'manuel',
    });
    const query = contactGeocodeQuery(merged.address, merged.secteur, merged.postalCodes);
    const geo = query
      ? await geocodeToColumns(query.adresse, query.codePostal, cache)
      : { ...EMPTY_BAN_GEO };
    const patch = {
      first_name: row.first_name,
      last_name: row.last_name,
      contact_type: row.contact_type,
      phone: row.phone,
      email: row.email,
      secteur: row.secteur,
      address: row.address,
      postal_codes: row.postal_codes,
      budget_min: row.budget_min,
      budget_max: row.budget_max,
      surface_min: row.surface_min,
      surface_max: row.surface_max,
      rooms_min: row.rooms_min,
      summary: row.summary,
      ...geo,
    };

    const { data, error } = await supabase
      .from('contacts')
      .update(patch)
      .eq('id', item.duplicate.id)
      .eq('agency_id', agency.id)
      .select(CONTACTS_SELECT)
      .single();
    if (error || !data) {
      console.error('[contacts/import] mise à jour', error);
      skipped.push({ line: item.line, reason: 'Mise à jour impossible' });
      continue;
    }
    const contact = mapDbContactToContact(data as unknown as ContactRow);
    byId.set(contact.id, contact);
    updated.push(contact);
  }

  return NextResponse.json({ created, updated, skipped });
}
