/**
 * Vérifie le rebranchement parcelle — aucune écriture, aucun import.
 *   npx tsx scripts/verify-parcelle-reconnect.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fetchParcelleFiche, fetchParcelleOverlays, PARCELLE_READ_QUERIES } from '@/lib/queries/parcelle';

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
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const TARGET = '75120000EC0003';
  const agencyId = '34fca84a-797f-4827-8cfe-d10af156620e';
  const viewer = { id: 'verify', role: 'directeur' as const };

  const t0 = Date.now();
  const fiche = await fetchParcelleFiche({
    publicDb: sb as never,
    agencyDb: sb as never,
    parcelleId: TARGET,
    agencyId,
    postalCodes: ['75020'],
    viewer,
  });
  const ficheMs = Date.now() - t0;

  console.log('=== FICHE', TARGET, ficheMs + 'ms ===');
  console.log(JSON.stringify({
    parcelleId: fiche.parcelleId,
    adresse: fiche.adresse,
    videPublic: fiche.videPublic,
    ventes: fiche.ventes.length,
    diagnostics: fiche.diagnostics.length,
    coproprietes: fiche.coproprietes.length,
    surCetteParcelle: fiche.surCetteParcelle.length,
  }, null, 2));
  console.log('ventes détail', fiche.ventes);
  console.log('diagnostics', fiche.diagnostics.slice(0, 8), fiche.diagnostics.length > 8 ? `… +${fiche.diagnostics.length - 8}` : '');
  console.log('coproprietes', fiche.coproprietes);

  const t1 = Date.now();
  const overlay = await fetchParcelleOverlays({
    publicDb: sb as never,
    agencyDb: sb as never,
    agencyId,
    postalCodes: ['75020'],
    viewer,
    viewport: { west: 2.40, south: 48.845, east: 2.42, north: 48.855, zoom: 16 },
  });
  const overlayMs = Date.now() - t1;
  console.log('\n=== OVERLAY emprise Maraîchers', overlayMs + 'ms ===');
  console.log({ immeubles: overlay.immeubles.length, notes: overlay.notes.length });
  const hit = overlay.immeubles.find((i) => i.parcelleId === TARGET);
  console.log('immeuble cible', hit);

  console.log('\n=== REQUÊTES DU MODULE ===');
  console.log(JSON.stringify(PARCELLE_READ_QUERIES, null, 2));

  const dropped = [];
  for (const table of ['parcelle_ventes', 'parcelle_diagnostics']) {
    const { error } = await sb.from(table).select('*', { count: 'exact', head: true });
    dropped.push({ table, stillThere: !error, error: error?.message ?? null });
  }
  console.log('\n=== TABLES À SUPPRIMER (migration 20260831) ===', dropped);

  console.log(`
=== SQL DES DEUX REQUÊTES PRINCIPALES (pour EXPLAIN ANALYZE) ===

-- Couche carte (agrégat immeuble, jamais les tables de détail)
EXPLAIN (ANALYZE, BUFFERS)
SELECT ban_id, parcelle_id, adresse, code_postal, lat, lng
FROM public.buildings
WHERE code_postal IN ('75020')
  AND lat BETWEEN 48.845 AND 48.855
  AND lng BETWEEN 2.40 AND 2.42
  AND lat IS NOT NULL AND lng IS NOT NULL
LIMIT 2500;

-- Fiche (une parcelle, tables de détail)
EXPLAIN (ANALYZE, BUFFERS)
SELECT parcelle_id, ban_id, date_mutation, valeur_fonciere, surface_reelle_bati, prix_m2
FROM public.building_transactions
WHERE parcelle_id = '75120000EC0003'
ORDER BY date_mutation DESC;
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
