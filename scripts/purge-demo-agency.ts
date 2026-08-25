/**
 * Purge réversible du jeu de démo — agence test uniquement.
 *
 *   npx tsx scripts/purge-demo-agency.ts
 *
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEMO_AGENCY_ID, PROTECTED_AGENCY_PREFIXES } from '../lib/demo/constants';
import { createSupabaseAdminClient } from '../lib/supabase/admin';

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
    /* optional */
  }
}

async function restoreLeads(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: snaps, error } = await admin
    .from('demo_lead_snapshots')
    .select('lead_id, snapshot')
    .eq('agency_id', DEMO_AGENCY_ID);
  if (error) {
    console.warn('[purge-demo] snapshots leads ignorés', error.message);
    return 0;
  }
  let n = 0;
  for (const row of snaps ?? []) {
    const snap = row.snapshot as Record<string, unknown>;
    const { error: up } = await admin.from('leads').update(snap).eq('id', row.lead_id);
    if (!up) n += 1;
  }
  await admin.from('demo_lead_snapshots').delete().eq('agency_id', DEMO_AGENCY_ID);
  return n;
}

async function deleteDemoRows(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
): Promise<number> {
  const { data, error } = await admin.from(table).delete().eq('agency_id', DEMO_AGENCY_ID).eq('is_demo', true).select('id');
  if (error) {
    console.warn(`[purge-demo] ${table}`, error.message);
    return 0;
  }
  return data?.length ?? 0;
}

async function purgeDemoUsers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: profiles, error } = await admin.from('profiles').select('id').eq('is_demo', true);
  if (error) throw error;
  let n = 0;
  for (const p of profiles ?? []) {
    const { data: links } = await admin
      .from('profile_agencies')
      .select('agency_id')
      .eq('profile_id', p.id)
      .eq('agency_id', DEMO_AGENCY_ID);
    if (!links?.length) continue;
    await admin.from('profile_agencies').delete().eq('profile_id', p.id).eq('agency_id', DEMO_AGENCY_ID);
    await admin.auth.admin.deleteUser(p.id);
    n += 1;
  }
  return n;
}

async function main() {
  loadEnvLocal();
  if (DEMO_AGENCY_ID !== '34fca84a-797f-4827-8cfe-d10af156620e') {
    throw new Error('Refus : DEMO_AGENCY_ID invalide');
  }
  for (const prefix of PROTECTED_AGENCY_PREFIXES) {
    if (DEMO_AGENCY_ID.startsWith(prefix) && DEMO_AGENCY_ID !== '34fca84a-797f-4827-8cfe-d10af156620e') {
      throw new Error(`Refus : agence protégée (${prefix})`);
    }
  }
  const admin = createSupabaseAdminClient();

  const { data: agency } = await admin.from('agencies').select('id, name').eq('id', DEMO_AGENCY_ID).maybeSingle();
  if (!agency) {
    console.error(`Agence test introuvable : ${DEMO_AGENCY_ID}`);
    process.exit(1);
  }
  console.log(`Purge démo — ${agency.name} (${DEMO_AGENCY_ID})`);

  const restored = await restoreLeads(admin);
  console.log(`Leads restaurés : ${restored}`);

  const order = [
    'note_liens',
    'agency_alerts',
    'contact_interactions',
    'voice_notes',
    'rendez_vous',
    'promesses',
    'offres',
    'visites',
    'biens',
    'contacts',
  ] as const;

  let total = 0;
  for (const table of order) {
    const n = await deleteDemoRows(admin, table);
    console.log(`  ${table}: ${n}`);
    total += n;
  }

  const users = await purgeDemoUsers(admin);
  console.log(`Utilisateurs démo supprimés : ${users}`);
  console.log(`Purge terminée (${total} lignes métier).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
