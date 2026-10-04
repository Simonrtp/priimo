/**
 * Importe les propriétaires personnes morales, lot par lot, des communes
 * couvertes par Priimo (fichier des locaux DGFiP, Licence Ouverte).
 *
 *   npx tsx scripts/importer-proprietaires-lots.ts            → simulation
 *   npx tsx scripts/importer-proprietaires-lots.ts --ecrire   → écrit
 *
 * Sans `--zip`, l'archive du millésime (`--millesime`, 2025 par défaut) est
 * téléchargée sur data.economie.gouv.fr (« Fichiers des locaux et des
 * parcelles des personnes morales », ~200 Mo) puis gardée dans le dossier
 * temporaire. `--zip chemin/locaux.zip` lit une archive déjà téléchargée.
 * Lecture du zip en Node pur : marche sous PowerShell comme sous Bash.
 *
 * Pourquoi : la BDNB ne donne que la liste des sociétés propriétaires d'un
 * bâtiment. Une SCI y figure qu'elle détienne l'immeuble entier ou un seul
 * studio. Le fichier DGFiP descend au lot : on sait combien, et à quel étage.
 *
 * Ré-importer un nouveau millésime met à jour les lignes existantes ; une
 * société qui a vendu entre-temps reste jusqu'à purge du millésime précédent
 * (`delete from parcelle_proprietaires where millesime < N`).
 */

import { createReadStream, createWriteStream, existsSync, readFileSync, renameSync, statSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { createInflateRaw } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';
import { AgregatLots, type LigneLocal } from '../lib/carte/proprietaires-lots';

const PAGE = 1000;
const LOT_ECRITURE = 1000;
const SOURCE =
  'https://data.economie.gouv.fr/api/v2/catalog/datasets/fichiers-des-locaux-et-des-parcelles-des-personnes-morales/attachments';

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
const zipFourni = argument('--zip');
const millesime = Number(argument('--millesime') ?? '2025');
if (zipFourni && !existsSync(zipFourni)) {
  console.error(`Archive introuvable : ${zipFourni}\nOmettre --zip pour la télécharger automatiquement.`);
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** L'archive du millésime, téléchargée une fois puis gardée en cache. */
async function archive(): Promise<string> {
  if (zipFourni) return zipFourni;
  const chemin = join(tmpdir(), `priimo-locaux-personnes-morales-${millesime}.zip`);
  if (existsSync(chemin) && statSync(chemin).size > 1_000_000) {
    console.log(`Archive déjà téléchargée : ${chemin}`);
    return chemin;
  }
  const url = `${SOURCE}/fichier_des_locaux_situation_${millesime}_zip`;
  console.log(`Téléchargement du millésime ${millesime} (~200 Mo)…`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`téléchargement ${res.status} : ${url}`);
  await pipeline(Readable.fromWeb(res.body as WebReadableStream), createWriteStream(`${chemin}.part`));
  renameSync(`${chemin}.part`, chemin);
  return chemin;
}

type EntreeZip = { nom: string; methode: number; tailleCompressee: number; offsetLocal: number };

/** Le répertoire central de l'archive (zip64 compris). */
async function entreesZip(chemin: string): Promise<EntreeZip[]> {
  const fh = await open(chemin, 'r');
  try {
    const { size } = await fh.stat();
    const longueur = Math.min(size, 22 + 65_535);
    const queue = Buffer.alloc(longueur);
    await fh.read(queue, 0, longueur, size - longueur);
    const eocd = queue.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) throw new Error(`${chemin} n'est pas une archive zip`);
    let nombre = queue.readUInt16LE(eocd + 10);
    let taille = queue.readUInt32LE(eocd + 12);
    let debut = queue.readUInt32LE(eocd + 16);
    if (nombre === 0xffff || debut === 0xffffffff) {
      const localisateur = queue.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]), eocd);
      if (localisateur < 0) throw new Error('zip64 sans localisateur');
      const e64 = Buffer.alloc(56);
      await fh.read(e64, 0, 56, Number(queue.readBigUInt64LE(localisateur + 8)));
      nombre = Number(e64.readBigUInt64LE(32));
      taille = Number(e64.readBigUInt64LE(40));
      debut = Number(e64.readBigUInt64LE(48));
    }
    const rep = Buffer.alloc(taille);
    await fh.read(rep, 0, taille, debut);
    const entrees: EntreeZip[] = [];
    let p = 0;
    for (let i = 0; i < nombre; i += 1) {
      if (rep.readUInt32LE(p) !== 0x02014b50) throw new Error('répertoire zip illisible');
      const methode = rep.readUInt16LE(p + 10);
      let tailleCompressee = rep.readUInt32LE(p + 20);
      const tailleBrute = rep.readUInt32LE(p + 24);
      const lnNom = rep.readUInt16LE(p + 28);
      const lnExtra = rep.readUInt16LE(p + 30);
      const lnCommentaire = rep.readUInt16LE(p + 32);
      let offsetLocal = rep.readUInt32LE(p + 42);
      // Noms avec un « à » mal encodé : latin1 garde au moins l'ASCII intact.
      const nom = rep.toString('latin1', p + 46, p + 46 + lnNom);
      // Champ zip64 : tailles et position au-delà de 4 Go, dans cet ordre.
      for (let q = p + 46 + lnNom; q + 4 <= p + 46 + lnNom + lnExtra; q += 4 + rep.readUInt16LE(q + 2)) {
        if (rep.readUInt16LE(q) !== 0x0001) continue;
        let r = q + 4;
        if (tailleBrute === 0xffffffff) r += 8;
        if (tailleCompressee === 0xffffffff) {
          tailleCompressee = Number(rep.readBigUInt64LE(r));
          r += 8;
        }
        if (offsetLocal === 0xffffffff) offsetLocal = Number(rep.readBigUInt64LE(r));
      }
      entrees.push({ nom, methode, tailleCompressee, offsetLocal });
      p += 46 + lnNom + lnExtra + lnCommentaire;
    }
    return entrees;
  } finally {
    await fh.close();
  }
}

/** Le contenu décompressé d'un fichier de l'archive, en flux. */
async function fluxEntree(chemin: string, e: EntreeZip): Promise<Readable> {
  const fh = await open(chemin, 'r');
  const tete = Buffer.alloc(30);
  try {
    await fh.read(tete, 0, 30, e.offsetLocal);
  } finally {
    await fh.close();
  }
  if (tete.readUInt32LE(0) !== 0x04034b50) throw new Error(`en-tête local illisible : ${e.nom}`);
  const debut = e.offsetLocal + 30 + tete.readUInt16LE(26) + tete.readUInt16LE(28);
  const brut = createReadStream(chemin, { start: debut, end: debut + e.tailleCompressee - 1 });
  if (e.methode === 0) return brut;
  if (e.methode !== 8) throw new Error(`compression ${e.methode} non gérée : ${e.nom}`);
  const inflate = createInflateRaw();
  brut.on('error', (err) => inflate.destroy(err));
  return brut.pipe(inflate);
}

/** Communes où Priimo a des adresses : on n'importe que celles-là. */
async function communesCouvertes(): Promise<Set<string>> {
  const communes = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('buildings')
      .select('ban_id')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const insee = (r.ban_id as string | null)?.slice(0, 5);
      if (insee && /^\d[\dAB]\d{3}$/.test(insee)) communes.add(insee);
    }
    if (!data || data.length < PAGE) break;
  }
  return communes;
}

function cleColonne(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** `…_750….csv` : les fichiers d'un département (Paris en a trois). */
function fichiersDuDepartement(entrees: readonly EntreeZip[], dep: string): EntreeZip[] {
  return entrees.filter((e) => {
    const base = e.nom.split('/').pop() ?? '';
    return e.tailleCompressee > 0 && /\.csv$/i.test(base) && base.includes(`_${dep}0`);
  });
}

/** Chaque fichier repart de son en-tête. */
async function lireFichier(
  chemin: string,
  entree: EntreeZip,
  communes: Set<string>,
  agregat: AgregatLots,
): Promise<number> {
  const flux = await fluxEntree(chemin, entree);
  flux.setEncoding('utf8');
  const lignes = createInterface({ input: flux, crlfDelay: Infinity });
  let index: Record<string, number> | null = null;
  let retenues = 0;
  for await (const ligne of lignes) {
    const c = ligne.split(';');
    if (/section/i.test(ligne) && /plan/i.test(ligne) && /nomination/i.test(ligne)) {
      index = Object.fromEntries(c.map((nom, i) => [cleColonne(nom), i]));
      continue;
    }
    if (!index) continue;
    const col = (k: string) => c[index![k] ?? -1] ?? '';
    const departement = col('departement').trim();
    const commune = col('codecommune').trim().padStart(3, '0');
    if (!communes.has(`${departement}${commune}`)) continue;
    const local: LigneLocal = {
      departement,
      commune,
      prefixe: col('prefixe'),
      section: col('section'),
      plan: col('nplan'),
      niveau: col('niveau'),
      droit: col('codedroit'),
      siren: col('nsiren'),
      groupe: col('groupepersonne'),
      forme: col('formejuridiqueabregee'),
      denomination: col('denomination'),
    };
    if (agregat.ajouter(local)) retenues += 1;
  }
  return retenues;
}

async function main() {
  console.log(ecrire ? '— ÉCRITURE dans parcelle_proprietaires —' : '— Simulation : rien ne sera écrit —');
  const communes = await communesCouvertes();
  const departements = [...new Set([...communes].map((c) => c.slice(0, 2)))];
  console.log(`${communes.size} communes couvertes · départements ${departements.join(', ')}`);

  const chemin = await archive();
  const entrees = await entreesZip(chemin);
  const agregat = new AgregatLots();
  for (const dep of departements) {
    const fichiers = fichiersDuDepartement(entrees, dep);
    if (fichiers.length === 0) {
      console.log(`  ${dep} : aucun fichier dans l'archive`);
      continue;
    }
    const t0 = Date.now();
    let n = 0;
    for (const f of fichiers) n += await lireFichier(chemin, f, communes, agregat);
    console.log(`  ${dep} : ${n} lots retenus (${Math.round((Date.now() - t0) / 1000)} s)`);
  }

  const lignes = agregat.resultat().map((l) => ({ ...l, millesime }));
  const sci = lignes.filter((l) => l.forme === 'SCI');
  const parcellesSci = new Set(sci.map((l) => l.parcelle_id));
  const unLot = sci.filter((l) => l.nb_lots === 1).length;
  console.log(`\n${lignes.length} couples parcelle × propriétaire · ${new Set(lignes.map((l) => l.parcelle_id)).size} parcelles`);
  console.log(`SCI : ${sci.length} présences sur ${parcellesSci.size} parcelles, dont ${unLot} avec un seul lot`);

  if (!ecrire) {
    console.log('\nSimulation terminée. Relancer avec --ecrire pour enregistrer.');
    return;
  }

  let ecrits = 0;
  for (let i = 0; i < lignes.length; i += LOT_ECRITURE) {
    const lot = lignes.slice(i, i + LOT_ECRITURE);
    const { error } = await db
      .from('parcelle_proprietaires')
      .upsert(lot, { onConflict: 'parcelle_id,siren,denomination,droit' });
    if (error) throw new Error(`écriture : ${error.message}`);
    ecrits += lot.length;
    if (ecrits % 20_000 < LOT_ECRITURE) console.log(`  ${ecrits} / ${lignes.length}`);
  }
  console.log(`\n${ecrits} lignes écrites.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
