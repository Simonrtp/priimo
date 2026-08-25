/**
 * Backfill BAN : géocode les contacts, biens et notes vocales sans ban_id.
 *
 *   npx tsx scripts/backfill-ban.ts
 *
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createBanGeocodeCache } from '../lib/geo/ban';
import { contactGeocodeQuery, geocodeToColumns, type BanGeoColumns } from '../lib/geo/fields';
import { createSupabaseAdminClient } from '../lib/supabase/admin';

const DELAY_MS = 50;

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i === -1) continue;
      const key = line.slice(0, i);
      const val = line.slice(i + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function addressFromStructured(structured: unknown): {
  address: string | null;
  secteur: string | null;
  postalCodes: string[];
} {
  if (!structured || typeof structured !== 'object') {
    return { address: null, secteur: null, postalCodes: [] };
  }
  const row = structured as Record<string, unknown>;
  const address = typeof row.address === 'string' ? row.address : null;
  const secteur = typeof row.secteur === 'string' ? row.secteur : null;
  const postalCodes = Array.isArray(row.postalCodes)
    ? row.postalCodes.filter((c): c is string => typeof c === 'string')
    : [];
  return { address, secteur, postalCodes };
}

async function applyGeo(
  table: 'contacts' | 'biens' | 'voice_notes' | 'leads',
  id: string,
  geo: BanGeoColumns,
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<boolean> {
  if (!geo.ban_id) return false;
  const { error } = await admin.from(table).update(geo).eq('id', id);
  if (error) {
    console.error(`[backfill-ban] ${table} ${id}`, error.message);
    return false;
  }
  return true;
}

async function main() {
  loadEnvLocal();
  const admin = createSupabaseAdminClient();
  const cache = createBanGeocodeCache();
  let updated = 0;
  let skipped = 0;

  const contacts = await admin
    .from('contacts')
    .select('id, address, secteur, postal_codes')
    .is('ban_id', null);
  if (contacts.error) throw new Error(contacts.error.message);

  for (const row of contacts.data ?? []) {
    const query = contactGeocodeQuery(row.address, row.secteur, row.postal_codes);
    if (!query) {
      skipped += 1;
      continue;
    }
    const geo = await geocodeToColumns(query.adresse, query.codePostal, cache);
    if (await applyGeo('contacts', row.id, geo, admin)) updated += 1;
    else skipped += 1;
    await sleep(DELAY_MS);
  }

  const biens = await admin.from('biens').select('id, address, postal_code').is('ban_id', null);
  if (biens.error) throw new Error(biens.error.message);

  for (const row of biens.data ?? []) {
    const geo = await geocodeToColumns(row.address, row.postal_code, cache);
    if (await applyGeo('biens', row.id, geo, admin)) updated += 1;
    else skipped += 1;
    await sleep(DELAY_MS);
  }

  const notes = await admin.from('voice_notes').select('id, structured').is('ban_id', null);
  if (notes.error) throw new Error(notes.error.message);

  for (const row of notes.data ?? []) {
    const extracted = addressFromStructured(row.structured);
    const query = contactGeocodeQuery(extracted.address, extracted.secteur, extracted.postalCodes);
    if (!query) {
      skipped += 1;
      continue;
    }
    const geo = await geocodeToColumns(query.adresse, query.codePostal, cache);
    if (await applyGeo('voice_notes', row.id, geo, admin)) updated += 1;
    else skipped += 1;
    await sleep(DELAY_MS);
  }

  const leads = await admin
    .from('leads')
    .select('id, address, postal_code, city')
    .is('ban_id', null);
  if (leads.error) {
    console.warn('[backfill-ban] leads ignorés', leads.error.message);
  } else {
    for (const row of leads.data ?? []) {
      const query = [row.address, row.postal_code, row.city].filter(Boolean).join(' ');
      const geo = await geocodeToColumns(query, row.postal_code, cache);
      if (await applyGeo('leads', row.id, geo, admin)) updated += 1;
      else skipped += 1;
      await sleep(DELAY_MS);
    }
  }

  console.log(`Backfill BAN terminé : ${updated} mis à jour, ${skipped} sans position.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
