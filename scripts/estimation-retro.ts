/**
 * Test rétrospectif du moteur : chaque vente est estimée sans elle-même
 * ni les ventes postérieures, puis comparée au prix réel.
 *
 *   npx tsx scripts/estimation-retro.ts
 *   npx tsx scripts/estimation-retro.ts --cp 75020 --limite 80
 *
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { runDvfEstimation } from '../lib/estimation/dvf-engine';

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i === -1) continue;
      const key = line.slice(0, i);
      const val = line.slice(i + 1);
      if (!process.env[key]) process.env[key] = val.replace(/^"|"$/g, '');
    }
  } catch {
    /* optional */
  }
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

function mediane(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

loadEnvLocal();

async function main() {
  const cp = arg('--cp', '');
  const limite = Number(arg('--limite', '60'));
  const admin = createSupabaseAdminClient();

  let q = admin
    .from('building_transactions')
    .select(
      'id, id_mutation, ban_id, parcelle_id, date_mutation, valeur_fonciere, surface_reelle_bati, prix_m2, type_local, code_postal',
    )
    .not('valeur_fonciere', 'is', null)
    .not('surface_reelle_bati', 'is', null)
    .gt('valeur_fonciere', 0)
    .gt('surface_reelle_bati', 15)
    .order('date_mutation', { ascending: false })
    .limit(Number.isFinite(limite) ? limite : 60);
  if (cp) q = q.eq('code_postal', cp);
  else q = q.in('code_postal', ['75020', '75011', '75019', '74000']);

  const { data, error } = await q;
  if (error || !data) {
    console.error(error?.message ?? 'Lecture des ventes impossible');
    process.exit(1);
  }

  const parCp = new Map<
    string,
    { erreurs: number[]; ok10: number; ok20: number; impossibles: number; n: number }
  >();

  for (const row of data) {
    const surface = Number(row.surface_reelle_bati);
    const prix = Number(row.valeur_fonciere);
    const postal = row.code_postal;
    const type = /maison/i.test(row.type_local ?? '') ? 'maison' : 'appartement';
    if (!postal || !Number.isFinite(surface) || surface <= 0 || !Number.isFinite(prix) || prix <= 0) {
      continue;
    }

    let lat = 48.86;
    let lng = 2.4;
    if (row.ban_id) {
      const { data: b } = await admin
        .from('buildings')
        .select('lat, lng')
        .eq('ban_id', row.ban_id)
        .limit(1)
        .maybeSingle();
      if (b?.lat != null && b.lng != null) {
        lat = b.lat;
        lng = b.lng;
      }
    }

    const result = await runDvfEstimation(
      admin,
      {
        address: postal,
        postalCode: postal,
        city: null,
        banId: row.ban_id,
        latitude: lat,
        longitude: lng,
        propertyType: type,
        surfaceM2: Math.round(surface),
        rooms: 3,
        floor: null,
        hasElevator: null,
        conditionRating: null,
        dpeClass: null,
        features: [],
        avant: row.date_mutation,
        excludeMutationId: row.id_mutation,
        maintenant: new Date(row.date_mutation),
      },
      null,
      async () => undefined,
      { sansBienici: true },
    );

    const bucket = parCp.get(postal) ?? { erreurs: [], ok10: 0, ok20: 0, impossibles: 0, n: 0 };
    bucket.n += 1;
    if (!result.available || result.value == null || result.value <= 0) {
      bucket.impossibles += 1;
    } else {
      const err = Math.abs(result.value - prix) / prix;
      bucket.erreurs.push(err);
      if (err <= 0.1) bucket.ok10 += 1;
      if (err <= 0.2) bucket.ok20 += 1;
    }
    parCp.set(postal, bucket);
  }

  console.log('code_postal\tn\terreur_mediane\t±10%\t±20%\timpossibles');
  for (const [code, b] of [...parCp.entries()].sort((a, c) => a[0].localeCompare(c[0]))) {
    const med = mediane(b.erreurs);
    const possibles = b.n - b.impossibles;
    console.log(
      [
        code,
        b.n,
        med != null ? `${(med * 100).toFixed(1)} %` : '—',
        possibles ? `${((b.ok10 / possibles) * 100).toFixed(0)} %` : '—',
        possibles ? `${((b.ok20 / possibles) * 100).toFixed(0)} %` : '—',
        `${b.impossibles}/${b.n}`,
      ].join('\t'),
    );
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
