/**
 * Rattache les copropriétés du Registre national (RNC, data.gouv) aux
 * parcelles couvertes par Priimo, puis à chacune de leurs adresses.
 *
 *   npx tsx scripts/importer-copro-rnc.ts --csv chemin/rnc.csv            → simulation
 *   npx tsx scripts/importer-copro-rnc.ts --csv chemin/rnc.csv --ecrire   → écrit
 *
 * Pourquoi : le premier import ne gardait que l'adresse de référence d'une
 * copro, géocodée avec un score BAN ≥ 0,8. Or le RNC abrège (« 16 r chanzy »),
 * ce qui fait tomber le score sous le seuil, et une copro couvre souvent
 * plusieurs numéros. Résultat : 16 % des adresses à plusieurs DPE avaient
 * une copro, et des arrondissements entiers aucune.
 *
 * Rattachement, du plus sûr au moins sûr :
 *   1. la référence cadastrale du RNC (jusqu'à 3 parcelles) ;
 *   2. l'adresse de référence et les adresses complémentaires, géocodées par
 *      la BAN : on n'accepte qu'un numéro identique, dans le même code postal,
 *      à moins de 150 m du point que le RNC donne pour la copro.
 * La copro est ensuite posée sur toutes les adresses BAN de la parcelle.
 *
 * N'ajoute que des lignes : un couple (adresse, immatriculation) déjà présent
 * n'est pas réécrit. Les géocodages sont gardés en cache dans le dossier
 * temporaire, la seconde passe (--ecrire) ne les redemande pas.
 */

import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PAGE = 1000;
const LOT_ECRITURE = 1000;
const LOT_GEOCODAGE = 500;
const DISTANCE_MAX_M = 150;
const GEOCODEUR = 'https://api-adresse.data.gouv.fr/search/csv/';
const CACHE = join(tmpdir(), 'priimo-rnc-geocodage.json');

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

function argument(nom: string): string | null {
  const i = process.argv.indexOf(nom);
  return i > -1 ? (process.argv[i + 1] ?? null) : null;
}

loadEnvLocal();
const ecrire = process.argv.includes('--ecrire');
const csv = argument('--csv');
if (!csv || !existsSync(csv)) {
  console.error(`Fichier RNC introuvable : ${csv ?? '(aucun --csv)'}`);
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/* ------------------------------------------------------------------ base */

async function toutLire<T>(table: string, colonnes: string, ordre: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let { data, error } = await db
      .from(table)
      .select(colonnes)
      .order(ordre, { ascending: true })
      .range(from, from + PAGE - 1);
    // Une coupure réseau passagère ne doit pas faire tout recommencer.
    for (let essai = 1; error && essai <= 8; essai += 1) {
      console.log(`  ${table} : coupure (${error.message}), nouvel essai ${essai}/8`);
      await new Promise((r) => setTimeout(r, Math.min(5000 * essai, 30_000)));
      ({ data, error } = await db
        .from(table)
        .select(colonnes)
        .order(ordre, { ascending: true })
        .range(from, from + PAGE - 1));
    }
    if (error) throw new Error(`${table} : ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/* ------------------------------------------------------------------- CSV */

/** Lignes CSV (virgules, guillemets doublés, retours à la ligne entre guillemets). */
async function* lignesCsv(chemin: string): AsyncGenerator<string[]> {
  let champ = '';
  let ligne: string[] = [];
  let entreGuillemets = false;
  let precedentGuillemet = false;
  for await (const morceau of createReadStream(chemin, { encoding: 'utf8' })) {
    for (const c of morceau as string) {
      if (entreGuillemets) {
        if (c === '"') {
          entreGuillemets = false;
          precedentGuillemet = true;
        } else champ += c;
        continue;
      }
      if (c === '"') {
        if (precedentGuillemet) champ += '"';
        entreGuillemets = true;
        precedentGuillemet = false;
        continue;
      }
      precedentGuillemet = false;
      if (c === ',') {
        ligne.push(champ);
        champ = '';
      } else if (c === '\n') {
        ligne.push(champ.replace(/\r$/, ''));
        yield ligne;
        ligne = [];
        champ = '';
      } else champ += c;
    }
  }
  if (champ || ligne.length) {
    ligne.push(champ);
    yield ligne;
  }
}

type CoproRnc = {
  immatriculation: string;
  insee: string;
  codePostal: string;
  adresses: string[];
  lat: number | null;
  lng: number | null;
  parcellesCadastre: string[];
  lots: number | null;
  periode: string | null;
  procedure: boolean;
  dateMaj: string | null;
};

/**
 * Identifiant de parcelle au format de la base (« 75111000CB0016 »). Paris
 * arrive parfois en commune unique avec l'arrondissement en préfixe
 * (« 75056 111 BT 0006 ») : on le replie sur le code de l'arrondissement.
 */
function idParcelle(insee: string, prefixe: string, section: string, numero: string): string | null {
  let commune = insee.trim();
  let pre = (prefixe.trim() || '000').padStart(3, '0');
  const sec = section.trim().toUpperCase().padStart(2, '0');
  const num = numero.trim().padStart(4, '0');
  if (!/^\d[\dAB]\d{3}$/.test(commune) || !/^[0-9A-Z]{2}$/.test(sec) || !/^\d{4}$/.test(num)) return null;
  const villeArrondie: Record<string, string> = { '75056': '75', '69123': '69', '13055': '13' };
  const dep = villeArrondie[commune];
  if (dep && pre !== '000') {
    commune = `${dep}${pre}`;
    pre = '000';
  }
  return `${commune}${pre}${sec}${num}`;
}

function entier(v: string): number | null {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------ géocodage */

/** « B183 RUE SAINT MARTIN 75003 PARIS » → numéro 183, sans la lettre du bâtiment. */
function numeroDe(adresse: string): number | null {
  const m = adresse.trim().match(/^[A-Z]?(\d{1,4})/i);
  return m ? Number(m[1]) : null;
}

const ABREVIATIONS: Record<string, string> = {
  r: 'rue',
  av: 'avenue',
  bd: 'boulevard',
  bld: 'boulevard',
  pl: 'place',
  imp: 'impasse',
  pas: 'passage',
  all: 'allée',
  qu: 'quai',
  rte: 'route',
  ch: 'chemin',
  sq: 'square',
  fg: 'faubourg',
  cite: 'cité',
};

/** L'adresse à demander à la BAN : lettre de bâtiment, code postal et ville retirés, voie dépliée. */
function adresseAGeocoder(adresse: string): string | null {
  const sans = adresse
    .trim()
    .replace(/^[A-Z](?=\d)/i, '')
    .replace(/\b\d{5}\b.*$/, '')
    .trim();
  if (!/^\d/.test(sans)) return null;
  return sans
    .split(/\s+/)
    .map((mot) => ABREVIATIONS[mot.toLowerCase()] ?? mot)
    .join(' ');
}

type Geocode = { banId: string; numero: number | null; codePostal: string; lat: number; lng: number } | null;

function lireCache(): Record<string, Geocode> {
  try {
    return JSON.parse(readFileSync(CACHE, 'utf8')) as Record<string, Geocode>;
  } catch {
    return {};
  }
}

function champsCsv(ligne: string): string[] {
  const out: string[] = [];
  let champ = '';
  let dedans = false;
  for (let i = 0; i < ligne.length; i += 1) {
    const c = ligne[i]!;
    if (dedans) {
      if (c === '"' && ligne[i + 1] === '"') {
        champ += '"';
        i += 1;
      } else if (c === '"') dedans = false;
      else champ += c;
    } else if (c === '"') dedans = true;
    else if (c === ',') {
      out.push(champ);
      champ = '';
    } else champ += c;
  }
  out.push(champ);
  return out;
}

async function geocoderLot(demandes: { cle: string; adresse: string; codePostal: string }[]): Promise<Map<string, Geocode>> {
  const corps = ['cle,adresse,postcode', ...demandes.map((d) => [d.cle, d.adresse, d.codePostal].map((v) => `"${v.replace(/"/g, '""')}"`).join(','))].join('\n');
  const form = new FormData();
  form.append('data', new Blob([corps], { type: 'text/csv' }), 'rnc.csv');
  form.append('columns', 'adresse');
  form.append('postcode', 'postcode');
  for (let essai = 1; ; essai += 1) {
    const res = await fetch(GEOCODEUR, { method: 'POST', body: form, signal: AbortSignal.timeout(120_000) }).catch((e: unknown) => {
      if (essai >= 4) throw e;
      return null;
    });
    if (res?.ok) {
      const [entete, ...lignes] = (await res.text()).split(/\r?\n/).filter(Boolean);
      const cols = champsCsv(entete!);
      const at = (c: string[], nom: string) => c[cols.indexOf(nom)] ?? '';
      const out = new Map<string, Geocode>();
      for (const l of lignes) {
        const c = champsCsv(l);
        const ok = at(c, 'result_type') === 'housenumber' && at(c, 'result_id');
        out.set(
          at(c, 'cle'),
          ok
            ? {
                banId: at(c, 'result_id'),
                numero: entier(at(c, 'result_housenumber')),
                codePostal: at(c, 'result_postcode'),
                lat: Number(at(c, 'latitude')),
                lng: Number(at(c, 'longitude')),
              }
            : null,
        );
      }
      return out;
    }
    if (essai >= 4) throw new Error(`géocodage ${res?.status ?? 'réseau'}`);
    await new Promise((r) => setTimeout(r, 3000 * essai));
  }
}

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const x = (bLng - aLng) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  const y = (bLat - aLat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/* ------------------------------------------------------------------ main */

async function main() {
  console.log(ecrire ? '— ÉCRITURE dans building_copro —' : '— Simulation : rien ne sera écrit —');

  const adressesParcelle = await toutLire<{ parcelle_id: string; ban_id: string }>(
    'parcelle_adresses',
    'parcelle_id, ban_id',
    'parcelle_id',
  );
  const batiments = await toutLire<{ ban_id: string | null; parcelle_id: string | null; code_postal: string | null }>(
    'buildings',
    'ban_id, parcelle_id, code_postal',
    'id',
  );
  const existantes = await toutLire<{ ban_id: string; numero_immatriculation: string | null }>(
    'building_copro',
    'ban_id, numero_immatriculation',
    'id',
  );

  const bansParParcelle = new Map<string, Set<string>>();
  const parcellesParBan = new Map<string, Set<string>>();
  const relier = (parcelle: string | null, ban: string | null) => {
    if (!parcelle || !ban) return;
    (bansParParcelle.get(parcelle) ?? bansParParcelle.set(parcelle, new Set()).get(parcelle)!).add(ban);
    (parcellesParBan.get(ban) ?? parcellesParBan.set(ban, new Set()).get(ban)!).add(parcelle);
  };
  for (const r of adressesParcelle) relier(r.parcelle_id, r.ban_id);
  const codePostalBan = new Map<string, string>();
  for (const b of batiments) {
    relier(b.parcelle_id, b.ban_id);
    if (b.ban_id && b.code_postal) codePostalBan.set(b.ban_id, b.code_postal);
  }
  const deja = new Set(existantes.map((e) => `${e.ban_id}§${e.numero_immatriculation ?? ''}`));
  const communes = new Set([...parcellesParBan.keys()].map((b) => b.slice(0, 5)));
  console.log(
    `${bansParParcelle.size} parcelles · ${parcellesParBan.size} adresses · ${communes.size} communes · ${existantes.length} copros déjà en base`,
  );

  /* Lecture du RNC, limitée aux communes couvertes. */
  const copros: CoproRnc[] = [];
  let entete: string[] | null = null;
  let lues = 0;
  for await (const c of lignesCsv(csv!)) {
    if (!entete) {
      entete = c;
      continue;
    }
    lues += 1;
    const col = (nom: string) => c[entete!.indexOf(nom)] ?? '';
    const insee = col('code_officiel_arrondissement_commune') || col('code_officiel_commune');
    if (!communes.has(insee)) continue;
    const parcellesCadastre: string[] = [];
    for (const i of [1, 2, 3]) {
      const id = col(`numero_parcelle_${i}`)
        ? idParcelle(col(`code_insee_parcelle_${i}`), col(`prefixe_parcelle_${i}`), col(`section_parcelle_${i}`), col(`numero_parcelle_${i}`))
        : null;
      if (id) parcellesCadastre.push(id);
    }
    const lotsHabitation = entier(col('nombre_lots_habitation'));
    const lat = Number.parseFloat(col('latitude'));
    const lng = Number.parseFloat(col('longitude'));
    copros.push({
      immatriculation: col('numero_immatriculation'),
      insee,
      codePostal: col('code_postal_adresse'),
      adresses: [col('numero_voie_adresse'), col('adresse_complementaire_1'), col('adresse_complementaire_2'), col('adresse_complementaire_3')].filter(Boolean),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      parcellesCadastre,
      lots: lotsHabitation ?? entier(col('nombre_total_lots')),
      periode: col('periode_construction') || null,
      // Même repère que le pipeline : syndic absent (mandat expiré sans successeur) ou copro aidée.
      procedure: /sans successeur/i.test(col('mandat_en_cours')) || /^oui$/i.test(col('copro_aidee').trim()),
      dateMaj: col('date_derniere_maj').slice(0, 10) || null,
    });
  }
  console.log(`RNC : ${lues} copros lues, ${copros.length} dans les communes couvertes`);

  /* Géocodage des adresses (cache disque). */
  const cache = lireCache();
  const aDemander = new Map<string, { cle: string; adresse: string; codePostal: string }>();
  for (const copro of copros) {
    for (const a of copro.adresses) {
      const q = adresseAGeocoder(a);
      const cp = a.match(/\b(\d{5})\b/)?.[1] ?? copro.codePostal;
      if (!q) continue;
      const cle = `${q.toLowerCase()}|${cp}`;
      if (!(cle in cache)) aDemander.set(cle, { cle, adresse: q, codePostal: cp });
    }
  }
  const liste = [...aDemander.values()];
  console.log(`Géocodage : ${liste.length} adresses à demander (${Object.keys(cache).length} en cache)`);
  for (let i = 0; i < liste.length; i += LOT_GEOCODAGE) {
    const res = await geocoderLot(liste.slice(i, i + LOT_GEOCODAGE));
    for (const [cle, g] of res) cache[cle] = g;
    writeFileSync(CACHE, JSON.stringify(cache));
    console.log(`  ${Math.min(i + LOT_GEOCODAGE, liste.length)} / ${liste.length}`);
  }

  /* Rattachement. */
  const motifs: Record<string, number> = {};
  const compter = (m: string) => (motifs[m] = (motifs[m] ?? 0) + 1);
  let parCadastre = 0;
  let parAdresse = 0;
  let accord = 0;
  let desaccord = 0;
  const lignes = new Map<string, Record<string, unknown>>();
  const parcellesTouchees = new Set<string>();

  for (const copro of copros) {
    const cadastre = copro.parcellesCadastre.filter((p) => bansParParcelle.has(p));
    const viaAdresse = new Set<string>();
    for (const a of copro.adresses) {
      const q = adresseAGeocoder(a);
      if (!q) continue;
      const cp = a.match(/\b(\d{5})\b/)?.[1] ?? copro.codePostal;
      const g = cache[`${q.toLowerCase()}|${cp}`];
      if (!g) continue;
      if (g.numero !== numeroDe(q) || (cp && g.codePostal !== cp)) continue;
      if (copro.lat != null && copro.lng != null && distanceM(copro.lat, copro.lng, g.lat, g.lng) > DISTANCE_MAX_M) continue;
      for (const p of parcellesParBan.get(g.banId) ?? []) viaAdresse.add(p);
    }
    if (cadastre.length > 0 && viaAdresse.size > 0) {
      if (cadastre.some((p) => viaAdresse.has(p))) accord += 1;
      else desaccord += 1;
    }
    // Le cadastre prime : l'adresse ne complète que lorsqu'il manque.
    const parcelles = cadastre.length > 0 ? cadastre : [...viaAdresse];
    if (parcelles.length === 0) {
      compter(copro.parcellesCadastre.length > 0 ? 'parcelle_hors_base' : 'adresse_non_retrouvee');
      continue;
    }
    if (cadastre.length > 0) parCadastre += 1;
    else parAdresse += 1;
    for (const p of parcelles) {
      parcellesTouchees.add(p);
      for (const ban of bansParParcelle.get(p) ?? []) {
        const cle = `${ban}§${copro.immatriculation}`;
        if (deja.has(cle) || lignes.has(cle)) continue;
        lignes.set(cle, {
          ban_id: ban,
          numero_immatriculation: copro.immatriculation || null,
          nombre_lots: copro.lots,
          periode_construction: copro.periode,
          procedure_en_cours: copro.procedure,
          date_maj: copro.dateMaj,
          source: 'rnc',
          code_postal: codePostalBan.get(ban) ?? null,
        });
      }
    }
  }

  const aEcrire = [...lignes.values()];
  console.log(`\nRattachées : ${parCadastre} par le cadastre, ${parAdresse} par l'adresse`);
  console.log(`Contrôle cadastre ↔ adresse sur les copros qui ont les deux : ${accord} d'accord, ${desaccord} en désaccord`);
  console.log(`Non rattachées : ${JSON.stringify(motifs)}`);
  console.log(`${parcellesTouchees.size} parcelles avec une copro · ${aEcrire.length} lignes nouvelles (adresse × copro)`);

  if (!ecrire) {
    console.log('\nSimulation terminée. Relancer avec --ecrire pour enregistrer.');
    return;
  }

  let ecrits = 0;
  for (let i = 0; i < aEcrire.length; i += LOT_ECRITURE) {
    const lot = aEcrire.slice(i, i + LOT_ECRITURE);
    const { error } = await db.from('building_copro').insert(lot);
    if (error) throw new Error(`écriture : ${error.message}`);
    ecrits += lot.length;
    if (ecrits % 10_000 < LOT_ECRITURE) console.log(`  ${ecrits} / ${aEcrire.length}`);
  }
  console.log(`\n${ecrits} lignes écrites.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
