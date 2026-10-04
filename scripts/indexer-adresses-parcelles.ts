/**
 * Rattache chaque adresse connue de Priimo à sa ou ses parcelles cadastrales.
 *
 *   npx tsx scripts/indexer-adresses-parcelles.ts            → simulation, rien n'est écrit
 *   npx tsx scripts/indexer-adresses-parcelles.ts --ecrire   → écrit dans parcelle_adresses
 *   … --communes 75111,72181                                  → limité à ces communes
 *
 * Pourquoi : la fiche parcelle retrouve ses DPE par les adresses (ban_id) de
 * la parcelle. L'index existant venait des adresses citées par les ventes
 * DVF : une parcelle sans vente récente n'avait aucune adresse, donc aucun
 * DPE. Mesuré le 02/10/2026 : 40 % des DPE de Paris 11e étaient atteignables
 * depuis une parcelle, 7 % sur certaines communes de Haute-Savoie.
 *
 * Deux sources, dans cet ordre :
 *  1. `ban`  — le lien cadastral publié par la Base Adresse Nationale
 *              (colonne cad_parcelles), quand la commune le fournit ;
 *  2. `geo`  — sinon, la parcelle du cadastre Etalab qui contient le point
 *              de l'adresse. Un point posé sur la chaussée ne rattache rien.
 *
 * Écriture strictement additive : un couple (parcelle, adresse) déjà présent
 * n'est jamais réécrit. Pour annuler : supprimer les lignes de source `ban`
 * ou `geo` créées par ce script.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';
import { indexerParcelles, lireParcelle, type IndexParcelles } from '../lib/carte/point-parcelle';

const UA = { 'user-agent': 'Priimo/1.0 (indexation adresses-parcelles)' };
const PAGE = 1000;
const LOT_ECRITURE = 500;

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    const key = line.slice(0, i);
    if (!process.env[key]) process.env[key] = line.slice(i + 1);
  }
}

loadEnvLocal();
const ecrire = process.argv.includes('--ecrire');
const iCommunes = process.argv.indexOf('--communes');
const communesDemandees =
  iCommunes > -1 ? new Set((process.argv[iCommunes + 1] ?? '').split(',').filter(Boolean)) : null;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function toutLire<T>(table: string, colonnes: string, filtre?: (q: ReturnType<typeof requete>) => unknown): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = requete(table, colonnes).range(from, from + PAGE - 1);
    if (filtre) q = filtre(q) as typeof q;
    const { data, error } = await q;
    if (error) throw new Error(`${table} : ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function requete(table: string, colonnes: string) {
  return db.from(table).select(colonnes).order(table === 'buildings' ? 'id' : 'ban_id', { ascending: true });
}

type AdresseBan = { cad: string[]; lon: number; lat: number; cp: string | null };

async function adressesBan(dep: string, communes: Set<string>): Promise<Map<string, AdresseBan>> {
  const corps = await telecharger(`https://adresse.data.gouv.fr/data/ban/adresses/latest/csv/adresses-${dep}.csv.gz`);
  if (!corps) throw new Error(`BAN ${dep} : fichier indisponible`);
  const csv = gunzipSync(corps).toString('utf8');
  const lignes = csv.split('\n');
  const entete = lignes[0]!.split(';');
  const col = (nom: string) => entete.indexOf(nom);
  const [iId, iInsee, iCp, iLon, iLat, iCad] = ['id', 'code_insee', 'code_postal', 'lon', 'lat', 'cad_parcelles'].map(col);
  const out = new Map<string, AdresseBan>();
  for (const ligne of lignes.slice(1)) {
    if (!ligne) continue;
    const c = ligne.split(';');
    if (!communes.has(c[iInsee!] ?? '')) continue;
    out.set(c[iId!]!, {
      cad: (c[iCad!] ?? '').split('|').map((s) => s.trim()).filter(Boolean),
      lon: Number(c[iLon!]),
      lat: Number(c[iLat!]),
      cp: c[iCp!] || null,
    });
  }
  return out;
}

const cadastres = new Map<string, IndexParcelles>();
const indexParCode = new Map<string, Promise<IndexParcelles>>();

/**
 * Quatre essais espacés, corps compris : les serveurs publics coupent parfois
 * une longue réponse en cours de lecture. Rend null sur une réponse en erreur.
 */
async function telecharger(url: string): Promise<Buffer | null> {
  let derniere: unknown = null;
  for (let essai = 0; essai < 4; essai += 1) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      derniere = e;
      await new Promise((r) => setTimeout(r, 2000 * (essai + 1)));
    }
  }
  throw derniere;
}

async function parcellesDeLaCommune(insee: string) {
  const corps = await telecharger(
    `https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/${insee}/geojson/parcelles`,
  );
  const json = corps
    ? (JSON.parse(corps.toString('utf8')) as { features?: { properties?: { id?: string }; geometry?: unknown }[] })
    : {};
  return (json.features ?? [])
    .map((f) => (f.properties?.id ? lireParcelle(f.properties.id, f.geometry) : null))
    .filter((p): p is NonNullable<typeof p> => p !== null);
}

/** Un même cadastre (Annecy pour ses communes déléguées) ne se télécharge qu'une fois. */
function indexDeLaCommune(code: string): Promise<IndexParcelles> {
  let p = indexParCode.get(code);
  if (!p) {
    p = parcellesDeLaCommune(code).then(indexerParcelles);
    indexParCode.set(code, p);
  }
  return p;
}

/**
 * Une commune déléguée (Annecy-le-Vieux, Seynod…) n'a plus de cadastre à
 * son ancien code : on prend celui de la commune nouvelle qui contient le point.
 */
async function cadastre(insee: string, point: { lon: number; lat: number }): Promise<IndexParcelles> {
  const connu = cadastres.get(insee);
  if (connu) return connu;
  let index = await indexDeLaCommune(insee);
  if (index.taille === 0) {
    const corps = await telecharger(`https://geo.api.gouv.fr/communes?lat=${point.lat}&lon=${point.lon}&fields=code`);
    const communes = corps ? (JSON.parse(corps.toString('utf8')) as { code?: string }[]) : [];
    const actuelle = communes[0]?.code;
    if (actuelle && actuelle !== insee) {
      console.log(`  ${insee} : commune déléguée, cadastre de ${actuelle}`);
      index = await indexDeLaCommune(actuelle);
    }
  }
  cadastres.set(insee, index);
  return index;
}

type Batiment = { ban_id: string | null; parcelle_id: string | null; lat: number | null; lng: number | null; code_postal: string | null };
type Lien = { parcelle_id: string; ban_id: string; source: 'ban' | 'geo'; code_postal: string | null };

async function main() {
  console.log(ecrire ? '— ÉCRITURE dans parcelle_adresses —' : '— Simulation : rien ne sera écrit —');

  const [tousBatiments, existants] = await Promise.all([
    toutLire<Batiment>('buildings', 'ban_id, parcelle_id, lat, lng, code_postal'),
    toutLire<{ parcelle_id: string; ban_id: string | null }>('parcelle_adresses', 'parcelle_id, ban_id'),
  ]);
  const batiments = tousBatiments.filter((b): b is Batiment & { ban_id: string } => Boolean(b.ban_id));
  const dejaLie = new Set(existants.map((r) => `${r.parcelle_id}|${r.ban_id}`));
  const lieAvant = new Set<string>([
    ...existants.map((r) => r.ban_id).filter((b): b is string => Boolean(b)),
    ...batiments.filter((b) => b.parcelle_id).map((b) => b.ban_id),
  ]);

  const parCommune = new Map<string, (Batiment & { ban_id: string })[]>();
  for (const b of batiments) {
    const insee = b.ban_id.slice(0, 5);
    if (!/^\d[\dAB]\d{3}$/.test(insee)) continue;
    if (communesDemandees && !communesDemandees.has(insee)) continue;
    const liste = parCommune.get(insee);
    if (liste) liste.push(b);
    else parCommune.set(insee, [b]);
  }
  const communes = new Set(parCommune.keys());
  const departements = [...new Set([...communes].map((c) => (c.startsWith('97') ? c.slice(0, 3) : c.slice(0, 2))))];
  console.log(`${batiments.length} adresses en base · ${communes.size} communes · départements ${departements.join(', ')}`);

  const ban = new Map<string, AdresseBan>();
  for (const dep of departements) {
    const lues = await adressesBan(dep, communes);
    for (const [id, a] of lues) ban.set(id, a);
    console.log(`  BAN ${dep} : ${lues.size} adresses des communes couvertes`);
  }

  const nouveaux: Lien[] = [];
  const bilan = { ban: 0, geo: 0, aucun: 0, lieAvant: 0, lieApres: 0, horsFormat: 0 };
  const parCommuneBilan: string[] = [];

  for (const [insee, liste] of [...parCommune].sort((a, b) => b[1].length - a[1].length)) {
    let avant = 0;
    let apres = 0;
    let index: IndexParcelles | null = null;
    for (const b of liste) {
      const etaitLie = lieAvant.has(b.ban_id);
      if (etaitLie) avant += 1;
      const a = ban.get(b.ban_id);
      let parcelles: string[] = a?.cad ?? [];
      let source: Lien['source'] = 'ban';
      if (parcelles.length === 0) {
        const lon = a?.lon ?? b.lng;
        const lat = a?.lat ?? b.lat;
        if (lon != null && lat != null && Number.isFinite(lon) && Number.isFinite(lat)) {
          index ??= await cadastre(insee, { lon, lat });
          const trouvee = index.trouver(lon, lat);
          parcelles = trouvee ? [trouvee] : [];
          source = 'geo';
        }
      }
      if (parcelles.length === 0) {
        bilan.aucun += 1;
        if (etaitLie) apres += 1;
        continue;
      }
      bilan[source] += 1;
      apres += 1;
      for (const brut of parcelles) {
        // Certaines communes publient « 74256    B0240 » : des espaces à la place
        // des zéros de remplissage. Le reste (« 75 » seul…) est écarté : la
        // table n'accepte que les 14 caractères du cadastre.
        const parcelle_id = brut.toUpperCase().replace(/ /g, '0');
        if (!/^[0-9A-Z]{14}$/.test(parcelle_id)) {
          bilan.horsFormat += 1;
          if (bilan.horsFormat <= 3) console.log(`  référence ignorée : « ${brut} »`);
          continue;
        }
        const cle = `${parcelle_id}|${b.ban_id}`;
        if (dejaLie.has(cle)) continue;
        dejaLie.add(cle);
        nouveaux.push({ parcelle_id, ban_id: b.ban_id, source, code_postal: a?.cp ?? b.code_postal });
      }
    }
    bilan.lieAvant += avant;
    bilan.lieApres += apres;
    if (liste.length >= 400) {
      parCommuneBilan.push(
        `  ${insee} : ${liste.length} adresses · rattachées ${Math.round((100 * avant) / liste.length)} % → ${Math.round((100 * apres) / liste.length)} %`,
      );
    }
  }

  console.log(parCommuneBilan.join('\n'));
  const total = [...parCommune.values()].reduce((n, l) => n + l.length, 0);
  console.log(
    `\nAdresses rattachées à une parcelle : ${Math.round((100 * bilan.lieAvant) / total)} % → ${Math.round((100 * bilan.lieApres) / total)} %`,
  );
  console.log(`Par la BAN : ${bilan.ban} · par la géométrie : ${bilan.geo} · sans parcelle trouvée : ${bilan.aucun}`);
  console.log(`Liens nouveaux à écrire : ${nouveaux.length} · références hors format ignorées : ${bilan.horsFormat}`);

  if (!ecrire) {
    console.log('\nSimulation terminée. Relancer avec --ecrire pour enregistrer.');
    return;
  }

  let ecrits = 0;
  for (let i = 0; i < nouveaux.length; i += LOT_ECRITURE) {
    const lot = nouveaux.slice(i, i + LOT_ECRITURE);
    const { error } = await db
      .from('parcelle_adresses')
      .upsert(lot, { onConflict: 'parcelle_id,ban_id', ignoreDuplicates: true });
    if (error) throw new Error(`écriture : ${error.message}`);
    ecrits += lot.length;
    if (ecrits % 10_000 < LOT_ECRITURE) console.log(`  ${ecrits} / ${nouveaux.length}`);
  }
  console.log(`\n${ecrits} liens écrits.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
