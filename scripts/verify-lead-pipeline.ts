/**
 * Vérifie la répartition des leads par stage_id après migration pipeline.
 *
 *   npx tsx scripts/verify-lead-pipeline.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    const key = line.slice(0, i);
    const val = line.slice(i + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: agencies, error: agErr } = await sb.from('agencies').select('id, name').order('name');
  if (agErr) {
    console.error('Erreur agencies:', agErr.message);
    process.exit(1);
  }

  const { data: stages, error: stErr } = await sb.from('lead_stages').select('id, agency_id, cle, libelle, ordre');
  if (stErr) {
    console.error('Table lead_stages absente ou inaccessible:', stErr.message);
    process.exit(1);
  }

  const { data: leads, error: ldErr } = await sb.from('leads').select('id, agency_id, stage_id, status');
  if (ldErr) {
    console.error('Erreur leads:', ldErr.message);
    process.exit(1);
  }

  const stageById = new Map((stages ?? []).map((s) => [s.id, s]));
  const stageCleByAgency = new Map<string, Map<string, string>>();
  for (const s of stages ?? []) {
    if (!stageCleByAgency.has(s.agency_id)) stageCleByAgency.set(s.agency_id, new Map());
    stageCleByAgency.get(s.agency_id)!.set(s.cle, s.id);
  }

  console.log('Répartition leads par stage_id :\n');
  for (const agency of agencies ?? []) {
    const agencyLeads = (leads ?? []).filter((l) => l.agency_id === agency.id);
    const counts = new Map<string, number>();
    counts.set('(NULL — livré, pas pris)', 0);

    for (const s of stages ?? []) {
      if (s.agency_id === agency.id) counts.set(s.cle, 0);
    }

    for (const l of agencyLeads) {
      if (l.stage_id === null) {
        counts.set('(NULL — livré, pas pris)', (counts.get('(NULL — livré, pas pris)') ?? 0) + 1);
      } else {
        const st = stageById.get(l.stage_id);
        const key = st?.cle ?? `? ${l.stage_id}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    console.log(`${agency.name} (${agency.id}) — ${agencyLeads.length} leads`);
    for (const [k, v] of [...counts.entries()]) {
      if (v > 0) console.log(`  ${k}: ${v}`);
    }

    const expectedStages = ['pris', 'contacte', 'rendez_vous', 'mandat', 'perdu'];
    const missing = expectedStages.filter((c) => !stageCleByAgency.get(agency.id)?.has(c));
    if (missing.length) console.log(`  ⚠ étapes manquantes: ${missing.join(', ')}`);
    console.log('');
  }

  const { count: eventCount, error: evErr } = await sb
    .from('lead_stage_events')
    .select('*', { count: 'exact', head: true });
  if (!evErr) console.log(`lead_stage_events : ${eventCount ?? 0} lignes (attendu 0 juste après migration backfill)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
