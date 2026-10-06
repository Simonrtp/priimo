/**
 * Évaluation leave-one-out sur ventes DVF réelles.
 *
 *   npx tsx scripts/estimation-retro.ts
 *   npx tsx scripts/estimation-retro.ts --limite 200
 *
 * Variables : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSupabaseAdminClient } from '../lib/supabase/admin';
import {
  evaluerEchantillon,
  synthetiser,
  SEUILS_ACCEPTABLES,
  type EchantillonEvaluation,
} from '../lib/estimation/evaluation';
import { assemblerEstimation, construireIndice, preparerLot } from '../lib/estimation/moteur';

const PRIX_HUBBLE_ANGLET = 3_756_500;

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

function pct(n: number | null): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(1)} %`;
}

function euro(n: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

loadEnvLocal();

async function main() {
  const limite = Number(arg('--limite', '180'));
  const admin = createSupabaseAdminClient();

  const lots: Array<{
    id: string;
    id_mutation: string | null;
    ban_id: string | null;
    parcelle_id: string | null;
    date_mutation: string;
    valeur_fonciere: number | null;
    surface_reelle_bati: number | null;
    type_local: string | null;
    code_postal: string | null;
  }> = [];
  const coordsPreload = new Map<string, { lat: number; lng: number; cp: string }>();

  for (const prefix of ['75', '74', '64']) {
    const { data: bats } = await admin
      .from('buildings')
      .select('ban_id, lat, lng, code_postal')
      .like('code_postal', `${prefix}%`)
      .not('lat', 'is', null)
      .limit(500);
    const ids = (bats ?? []).map((b) => b.ban_id).filter(Boolean) as string[];
    for (const b of bats ?? []) {
      if (b.ban_id && b.lat != null && b.lng != null && b.code_postal) {
        coordsPreload.set(b.ban_id, { lat: b.lat, lng: b.lng, cp: b.code_postal });
      }
    }
    if (ids.length === 0) continue;
    const avant = lots.length;
    for (let i = 0; i < ids.length && lots.length - avant < Math.ceil(limite / 3); i += 80) {
      const slice = ids.slice(i, i + 80);
      const { data: txs } = await admin
        .from('building_transactions')
        .select(
          'id, id_mutation, ban_id, parcelle_id, date_mutation, valeur_fonciere, surface_reelle_bati, type_local, code_postal',
        )
        .in('ban_id', slice)
        .gt('valeur_fonciere', 40000)
        .gt('surface_reelle_bati', 20)
        .order('date_mutation', { ascending: false })
        .limit(40);
      lots.push(...(txs ?? []));
    }
  }
  const data = lots.slice(0, limite);

  const coords = new Map<string, { lat: number; lng: number }>();
  for (const [id, v] of coordsPreload) coords.set(id, { lat: v.lat, lng: v.lng });

  const echantillon: EchantillonEvaluation[] = [];
  for (const row of data) {
    const surface = Number(row.surface_reelle_bati);
    const prix = Number(row.valeur_fonciere);
    if (!Number.isFinite(surface) || surface <= 0 || !Number.isFinite(prix) || prix <= 0) continue;
    const c = row.ban_id ? coords.get(row.ban_id) : null;
    if (!c) continue;
    const postal = (row.ban_id ? coordsPreload.get(row.ban_id)?.cp : null) || row.code_postal;
    if (!postal) continue;
    const type = /maison/i.test(row.type_local ?? '') ? 'maison' : 'appartement';
    echantillon.push({
      id: String(row.id),
      zone: postal,
      type,
      surfaceM2: surface,
      prix,
      date: row.date_mutation,
      lat: c.lat,
      lng: c.lng,
      postalCode: postal,
    });
  }

  const lignes = evaluerEchantillon(echantillon);
  const rapport = synthetiser(lignes);

  const lignesTxt: string[] = [];
  const log = (s: string) => {
    console.log(s);
    lignesTxt.push(s);
  };

  log('Évaluation leave-one-out — ventes DVF exploitables');
  log(`n=${rapport.n} estimés=${rapport.nEstimes}`);
  log(
    `médiane |erreur|=${pct(rapport.medianePct)}  ±10%=${pct(rapport.part10)}  ±20%=${pct(rapport.part20)}`,
  );
  log(
    `Seuils proposés : médiane ≤ ${pct(SEUILS_ACCEPTABLES.medianePctMax)}, ±10% ≥ ${pct(SEUILS_ACCEPTABLES.part10Min)}, ±20% ≥ ${pct(SEUILS_ACCEPTABLES.part20Min)}`,
  );
  log('');
  log('Par zone (code postal)');
  for (const [zone, r] of Object.entries(rapport.parZone).sort((a, b) => a[0].localeCompare(b[0]))) {
    log(`${zone}\tn=${r.n}\testimés=${r.nEstimes}\tmédiane=${pct(r.medianePct)}\t±10%=${pct(r.part10)}\t±20%=${pct(r.part20)}`);
  }
  log('');
  log('Par type');
  for (const [type, r] of Object.entries(rapport.parType)) {
    log(`${type}\tn=${r.n}\testimés=${r.nEstimes}\tmédiane=${pct(r.medianePct)}\t±10%=${pct(r.part10)}\t±20%=${pct(r.part20)}`);
  }

  const anglet = echantillon.filter((e) => e.postalCode.startsWith('64') && e.type === 'maison');
  if (anglet.length > 0) {
    const cible = [...anglet].sort(
      (a, b) => Math.abs(a.prix - PRIX_HUBBLE_ANGLET) - Math.abs(b.prix - PRIX_HUBBLE_ANGLET),
    )[0]!;
    const r = assemblerEstimation({
      input: {
        surfaceM2: cible.surfaceM2,
        propertyType: 'maison',
        floor: null,
        hasElevator: null,
        dernierEtage: null,
        conditionRating: null,
        dpeClass: null,
        balconTerrasse: false,
        piscine: false,
        annexes: [],
        terrainM2: null,
      },
      lot: preparerLot(
        anglet.filter((v) => v.id !== cible.id).map((v) => ({
          id: v.id,
          idMutation: v.id,
          dateMutation: v.date,
          valeurFonciere: v.prix,
          surfaceM2: v.surfaceM2,
          prixM2: v.prix / v.surfaceM2,
          typeLocal: 'Maison',
          natureMutation: 'Vente',
          banId: v.id,
          parcelleId: v.id,
          lat: v.lat,
          lng: v.lng,
          adresse: v.zone,
          codePostal: v.postalCode,
          surfaceTerrain: null,
        })),
        {
          surfaceM2: cible.surfaceM2,
          propertyType: 'maison',
          floor: null,
          hasElevator: null,
          dernierEtage: null,
          conditionRating: null,
          dpeClass: null,
          balconTerrasse: false,
          piscine: false,
          annexes: [],
          terrainM2: null,
        },
        { lat: cible.lat, lng: cible.lng, banId: cible.id, parcelleId: cible.id, voie: null },
        construireIndice(
          anglet.map((v) => ({
            id: v.id,
            idMutation: v.id,
            dateMutation: v.date,
            valeurFonciere: v.prix,
            surfaceM2: v.surfaceM2,
            prixM2: v.prix / v.surfaceM2,
            typeLocal: 'Maison',
            natureMutation: 'Vente',
            banId: v.id,
            parcelleId: v.id,
            lat: v.lat,
            lng: v.lng,
            adresse: v.zone,
            codePostal: v.postalCode,
            surfaceTerrain: null,
          })),
          new Date(),
        ),
        new Date(),
      ),
      indice: construireIndice(
        anglet.map((v) => ({
          id: v.id,
          idMutation: v.id,
          dateMutation: v.date,
          valeurFonciere: v.prix,
          surfaceM2: v.surfaceM2,
          prixM2: v.prix / v.surfaceM2,
          typeLocal: 'Maison',
          natureMutation: 'Vente',
          banId: v.id,
          parcelleId: v.id,
          lat: v.lat,
          lng: v.lng,
          adresse: v.zone,
          codePostal: v.postalCode,
          surfaceTerrain: null,
        })),
        new Date(),
      ),
      radiusM: 2000,
      fenetreMois: 36,
      exclues: [],
      maintenant: new Date(),
    });
    log('');
    log('Cohérence Anglet (contrôle, pas un objectif d’algo)');
    log(`Vente DVF la plus proche de PriceHubble ${euro(PRIX_HUBBLE_ANGLET)} : ${euro(cible.prix)} · ${Math.round(cible.surfaceM2)} m² · ${cible.postalCode}`);
    log(`Estimation Priimo (sans cette vente) : ${r.available ? euro(r.value) : 'pas assez de ventes comparables'}`);
    if (r.available && r.value) {
      log(`Écart vs PriceHubble : ${pct((r.value - PRIX_HUBBLE_ANGLET) / PRIX_HUBBLE_ANGLET)}`);
    }
  } else {
    log('');
    log('Cohérence Anglet : pas assez de maisons 64 dans l’échantillon chargé.');
  }

  const out = resolve(process.cwd(), 'scripts/evaluation-avis-rapport.txt');
  writeFileSync(out, lignesTxt.join('\n'), 'utf8');
  log(`Rapport écrit dans ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
