/**
 * Après 20260832 : recalcul d'agrégat (seuil TS) + EXPLAIN ANALYZE.
 *   npx tsx scripts/post-parcelle-activity.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_DPE_MIN_AGE_MONTHS } from '@/lib/carte/dpe-public';
import { refreshBuildingActivity } from '@/lib/carte/refresh-building-activity';

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    if (!process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1);
  }
}

function planSummary(node: unknown, depth = 0): string[] {
  if (!node || typeof node !== 'object') return [];
  const n = node as Record<string, unknown>;
  const indent = '  '.repeat(depth);
  const lines = [
    `${indent}${n['Node Type'] ?? '?'}  cost=${n['Actual Total Time'] ?? n['Total Cost']}ms  rows=${n['Actual Rows'] ?? n['Plan Rows']}  ${n['Index Name'] ? `index=${n['Index Name']}` : ''}${n['Relation Name'] ? ` rel=${n['Relation Name']}` : ''}`,
  ];
  const extra = n['Plans'];
  if (Array.isArray(extra)) {
    for (const child of extra) lines.push(...planSummary(child, depth + 1));
  }
  return lines;
}

async function main() {
  loadEnvLocal();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  console.log('seuil DPE (TS unique)', PUBLIC_DPE_MIN_AGE_MONTHS);
  const n = await refreshBuildingActivity(sb as never, ['75020']);
  console.log('refresh_building_activity 75020 →', n, 'lignes');

  const { data: sample, error: sErr } = await sb
    .from('building_activity')
    .select(
      'ban_id, nb_transactions_total, derniere_transaction_le, prix_m2_median, activite_score, etiquette_dpe, dernier_prix, nb_dpe_total, calcule_le',
    )
    .eq('ban_id', '75120_5985_00010')
    .maybeSingle();
  if (sErr) throw sErr;
  console.log('agrégat 75120_5985_00010', sample);

  const { count: buildings } = await sb.from('buildings').select('*', { count: 'exact', head: true });
  const { count: nullBan } = await sb.from('buildings').select('*', { count: 'exact', head: true }).is('ban_id', null);
  console.log('buildings', { total: buildings, ban_id_null: nullBan });

  for (const table of [
    'building_transactions',
    'building_dpe',
    'building_copro',
    'building_activity',
    'parcelle_adresses',
  ]) {
    const { count: nuls } = await sb.from(table).select('*', { count: 'exact', head: true }).is('code_postal', null);
    console.log(`${table}.code_postal NULL`, nuls);
  }

  const { error: syntheseErr } = await sb.from('parcelle_synthese').select('*', { count: 'exact', head: true });
  console.log('parcelle_synthese', syntheseErr ? `supprimée (${syntheseErr.message})` : 'encore présente');

  const { data: plan, error: pErr } = await sb.rpc('explain_parcelle_queries', {
    p_codes_postaux: ['75020'],
    p_parcelle_id: '75120000EC0003',
    p_south: 48.845,
    p_north: 48.855,
    p_west: 2.4,
    p_east: 2.42,
  });
  if (pErr) throw pErr;
  const wrapped = plan as { layer?: unknown; fiche?: unknown };
  const layer = (Array.isArray(wrapped.layer) ? wrapped.layer[0] : wrapped.layer) as
    | { Plan?: unknown; 'Execution Time'?: number; 'Planning Time'?: number }
    | undefined;
  const fiche = (Array.isArray(wrapped.fiche) ? wrapped.fiche[0] : wrapped.fiche) as
    | { Plan?: unknown; 'Execution Time'?: number; 'Planning Time'?: number }
    | undefined;
  console.log('\n=== EXPLAIN couche buildings bbox ===');
  console.log('planning', layer?.['Planning Time'], 'execution', layer?.['Execution Time']);
  console.log(planSummary(layer?.Plan).join('\n'));
  console.log('\n=== EXPLAIN fiche transactions parcelle ===');
  console.log('planning', fiche?.['Planning Time'], 'execution', fiche?.['Execution Time']);
  console.log(planSummary(fiche?.Plan).join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
