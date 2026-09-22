/**
 * Lecture locale d’une dictée FR — filet si le modèle renvoie tout à null.
 * Ne devine pas un chiffre absent. Range seulement ce qui est clairement dit.
 */

import type { EstimationVoiceDraft } from '@/lib/estimation/voice-extract';

const MOTS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  premier: 1,
  premiere: 1,
  deuxieme: 2,
  troisieme: 3,
  quatrieme: 4,
  cinquieme: 5,
  sixieme: 6,
  septieme: 7,
  huitieme: 8,
  neuvieme: 9,
  dixieme: 10,
};

const NB =
  '(\\d+(?:[.,]\\d+)?|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)';
const UNITE_M2 = '(?:\\s*(?:m(?:2|²)|metres?\\s*carres?))?';
const ENVIRON = '(?:\\s*(?:de|d |d environ|environ|a peu pres|dans les))?';
const CORRECTION = /\b(?:ah\s+)?(?:non|pardon|en fait|plutot|plutôt|enfin)\b/;
const ANNEXES_MOTS: Array<{ re: string; libelle: 'Cave' | 'Parking' | 'Box' | 'Terrasse' }> = [
  { re: 'cave', libelle: 'Cave' },
  { re: 'parking|garage|stationnement', libelle: 'Parking' },
  { re: 'box', libelle: 'Box' },
  { re: 'terrasse|balcon', libelle: 'Terrasse' },
];
/** Juste avant le chiffre : « terrasse de 30 », pas « terrasse et un T3 de 70 ». */
const ANNEXE_TETE =
  /\b(?:cave|parking|garage|stationnement|box|terrasse|balcon)\b(?:\s+(?:de|d|d environ|environ|a peu pres|dans les))*\s*$/;
/** Juste après le chiffre : « 30 m² de cave », pas « 70 m2 avec cave ». */
const ANNEXE_COMPLEMENT =
  /^(?:\d+(?:[.,]\d+)?|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\s*(?:m(?:2|²)|metres?\s*carres?)?\s+(?:de\s+|d\s+)?(?:une?\s+)?(?:cave|parking|garage|stationnement|box|terrasse|balcon)\b/;

const FORTS = [
  'lumineux',
  'lumineuse',
  'calme',
  'moulures',
  'haussmannien',
  'haussmannienne',
  'traversant',
  'renove',
  'rénové',
  'renovee',
  'rénovée',
  'vue degagee',
  'vue dégagée',
  'double exposition',
  'standing',
  'parquet',
];

const FAIBLES = ['sombre', 'bruyant', 'bruyante', 'travaux', 'vis-a-vis', 'vis-à-vis', 'insalubre'];

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function motOuChiffre(raw: string): number | null {
  const compact = raw.replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr');
  if (MOTS[compact] != null) return MOTS[compact]!;
  const n = Number(compact.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function completerAnneeCourte(yy: number, maintenant = new Date()): number | null {
  const max = maintenant.getFullYear();
  if (yy >= 30 && yy <= 99) return 1900 + yy;
  if (yy >= 0 && yy <= 29) {
    const y = 2000 + yy;
    return y <= max ? y : null;
  }
  return null;
}

function anneesValidesDans(texte: string, maintenant = new Date()): number[] {
  const max = maintenant.getFullYear();
  const out: number[] = [];
  for (const hit of texte.matchAll(/\b(1[89]\d{2}|20[0-2]\d)\b/g)) {
    const y = Number(hit[1]);
    if (y >= 1800 && y <= max) out.push(y);
  }
  for (const hit of texte.matchAll(
    /\b(?:annee(?:\s+de\s+construction)?|construit\w*|construction)\s+(?:en\s+)?(\d{2})\b/g,
  )) {
    const y = completerAnneeCourte(Number(hit[1]), maintenant);
    if (y != null) out.push(y);
  }
  return out;
}

/** Dernière année dite, y compris « année 96 ». Ignore un style (« années 30 »). */
export function anneeDepuisDictée(raw: string, maintenant = new Date()): number | null {
  const n = norm(raw);
  if (/\bannees\s*(20|30|50|60|70)\b/.test(n) && !/\b(construction|construit)\b/.test(n)) {
    if (!/\b(1[89]\d{2}|20[0-2]\d)\b/.test(n)) return null;
  }
  const parties = n.split(CORRECTION);
  const cible = parties[parties.length - 1]?.trim() || n;
  const recentes = anneesValidesDans(cible, maintenant);
  if (recentes.length > 0) return recentes[recentes.length - 1]!;
  const toutes = anneesValidesDans(n, maintenant);
  return toutes.length > 0 ? toutes[toutes.length - 1]! : null;
}

function surfaceAnnexe(n: string, nomRe: string): number | null {
  const apres = n.match(new RegExp(`\\b(?:${nomRe})\\b${ENVIRON}\\s*${NB}${UNITE_M2}(?:\\s+environ)?`));
  const avant = n.match(
    new RegExp(`${NB}${UNITE_M2}\\s+(?:de\\s+|d\\s+)?(?:une?\\s+)?(?:${nomRe})\\b`),
  );
  const raw = apres?.[1] ?? avant?.[1];
  if (!raw) return null;
  return motOuChiffre(raw);
}

function extraireAnnexes(n: string): EstimationVoiceDraft['annexes'] {
  const out: EstimationVoiceDraft['annexes'] = [];
  for (const { re, libelle } of ANNEXES_MOTS) {
    if (!new RegExp(`\\b(?:${re})\\b`).test(n)) continue;
    out.push({
      libelle,
      surfaceM2: surfaceAnnexe(n, re),
      valorisationEur: null,
    });
  }
  return out;
}

/** Le chiffre complète l’annexe (« une terrasse de 30 m² »), pas un mot vu plus loin. */
function surfaceEstAnnexe(n: string, index: number): boolean {
  return ANNEXE_TETE.test(n.slice(0, index)) || ANNEXE_COMPLEMENT.test(n.slice(index));
}

function surfaceHabitable(n: string): number | null {
  const motif = /\b(\d+(?:[.,]\d+)?)\s*(?:m(?:2|²)|metres?\s*carres?)\b/g;
  for (const hit of n.matchAll(motif)) {
    if (surfaceEstAnnexe(n, hit.index ?? 0)) continue;
    const v = Number((hit[1] ?? '').replace(',', '.'));
    if (Number.isFinite(v) && v > 0 && v <= 10_000) return Math.round(v);
  }
  const libelle = n.match(/\bsurface(?:\s+(?:habitable|du bien|carrez))?(?:\s+(?:de|d ))?\s*(\d+(?:[.,]\d+)?)/);
  if (!libelle || surfaceEstAnnexe(n, libelle.index ?? 0)) return null;
  const v = Number((libelle[1] ?? '').replace(',', '.'));
  return Number.isFinite(v) && v > 0 && v <= 10_000 ? Math.round(v) : null;
}

function unique(list: string[]): string[] {
  const out: string[] = [];
  for (const item of list) {
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}

/** Surface du logement clairement dite, pas un m² d’annexe entendu trop tôt. */
export function ditSurfaceLogement(raw: string): boolean {
  const n = norm(raw);
  return /\b(?:t\s*[1-7]|f\s*[1-7]|studio|appart|maison|villa|pavillon|logement|surface|carrez|\d+\s*pieces?)\b/.test(
    n,
  );
}

export function extractEstimationHeuristic(transcript: string): EstimationVoiceDraft {
  const draft: EstimationVoiceDraft = {
    propertyType: null,
    sousType: null,
    rooms: null,
    chambres: null,
    surfaceM2: null,
    carrez: null,
    surfaceTerrain: null,
    niveaux: null,
    floor: null,
    etagesImmeuble: null,
    dernierEtage: null,
    anneeConstruction: null,
    qualiteEmplacement: null,
    ascenseur: null,
    balconTerrasse: null,
    occupation: null,
    loyerAnnuel: null,
    chargesAnnuelles: null,
    chargesCopro: null,
    taxeFonciere: null,
    annexes: [],
    dpeClass: null,
    ges: null,
    consoKwh: null,
    dpeVersion: null,
    pointsForts: [],
    pointsFaibles: [],
    commentairesPublics: null,
  };
  const raw = transcript.trim();
  if (raw.length < 6) return draft;
  const n = norm(raw);

  if (/\b(maison|villa|pavillon)\b/.test(n)) draft.propertyType = 'maison';
  else if (/\b(appart|studio|duplex|triplex|loft|t\s*[1-7]|f\s*[1-7])\b/.test(n)) {
    draft.propertyType = 'appartement';
  }

  if (/\bstudio\b/.test(n)) {
    draft.sousType = 'Studio';
    draft.rooms = 1;
  } else if (/\bduplex\b/.test(n)) draft.sousType = 'Duplex';
  else if (/\btriplex\b/.test(n)) draft.sousType = 'Triplex';
  else if (/\bloft\b/.test(n)) draft.sousType = 'Loft';

  const tf = n.match(/\b(?:t|f)\s*([1-7])\b/);
  if (tf) draft.rooms = Number(tf[1]);
  const pieces = n.match(/\b(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s*pieces?\b/);
  if (pieces) draft.rooms = motOuChiffre(pieces[1] ?? '') ?? draft.rooms;

  const chambres = n.match(
    /\b(\d+|une|deux|trois|quatre|cinq|six)\s*chambres?\b/,
  );
  if (chambres) draft.chambres = motOuChiffre(chambres[1] ?? '');

  draft.surfaceM2 = surfaceHabitable(n);

  const terrain = n.match(/\bterrain(?:\s+(?:de|d ))?\s*(\d+(?:[.,]\d+)?)/);
  if (terrain) {
    const v = Number((terrain[1] ?? '').replace(',', '.'));
    if (Number.isFinite(v) && v > 0 && v <= 1_000_000) draft.surfaceTerrain = Math.round(v);
  }

  if (/\bcarrez\b/.test(n)) draft.carrez = true;

  if (/\b(rdc|rez de chaussee|rez-de-chaussee)\b/.test(n)) draft.floor = 'RDC';
  else {
    const etage = n.match(
      /\b(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|premier|premiere|deuxieme|troisieme|quatrieme|cinquieme|sixieme)(?:er|e|eme)?\s*etage\b/,
    );
    if (etage) {
      const v = motOuChiffre(etage[1] ?? '');
      if (v != null && v >= 1 && v <= 19) draft.floor = String(v);
      else if (v != null && v >= 20) draft.floor = '20+';
    }
  }

  const immeuble = n.match(/\b(?:immeuble|batiment)\s+(?:de\s+)?(\d+)\s*etages?\b/);
  if (immeuble) draft.etagesImmeuble = Number(immeuble[1]);

  if (/\bdernier etage\b/.test(n)) draft.dernierEtage = true;

  draft.anneeConstruction = anneeDepuisDictée(raw);

  if (/\b(tres bon emplacement|tres bien situe)\b/.test(n)) draft.qualiteEmplacement = 'Très bon';
  else if (/\b(bon emplacement|bien situe)\b/.test(n)) draft.qualiteEmplacement = 'Bon';
  else if (/\bemplacement moyen\b/.test(n)) draft.qualiteEmplacement = 'Moyen';

  if (/\b(sans ascenseur|pas d ?ascenseur|aucun ascenseur)\b/.test(n)) draft.ascenseur = false;
  else if (/\bascenseur\b/.test(n)) draft.ascenseur = true;

  if (/\b(sans balcon|sans terrasse)\b/.test(n)) draft.balconTerrasse = false;
  else if (/\b(balcon|terrasse)\b/.test(n)) draft.balconTerrasse = true;

  if (/\b(occupe|loue|locataire|loue)\b/.test(n)) draft.occupation = 'occupe';
  else if (/\b(libre|vacant)\b/.test(n)) draft.occupation = 'libre';

  const loyer = n.match(/\bloyer(?:\s+(?:annuel|de))?\s*(\d[\d .]{0,8})/);
  if (loyer) {
    const v = Number((loyer[1] ?? '').replace(/\s|\./g, ''));
    if (v > 0 && v <= 10_000_000) draft.loyerAnnuel = v;
  }
  const copro = n.match(/\bcharges(?:\s+de)?(?:\s+copro(?:priete)?)?\s*(\d[\d .]{0,6})/);
  if (copro && !/\bloyer\b/.test(copro[0] ?? '')) {
    const v = Number((copro[1] ?? '').replace(/\s|\./g, ''));
    if (v > 0 && v <= 10_000_000) draft.chargesCopro = v;
  }
  const taxe = n.match(/\btaxe fonciere\s*(?:de\s*)?(\d[\d .]{0,6})/);
  if (taxe) {
    const v = Number((taxe[1] ?? '').replace(/\s|\./g, ''));
    if (v > 0 && v <= 10_000_000) draft.taxeFonciere = v;
  }

  draft.annexes = extraireAnnexes(n);

  const dpe = n.match(/\bdpe\s*(?:classe\s*)?([a-g])\b/);
  if (dpe) draft.dpeClass = (dpe[1] ?? '').toUpperCase();
  const ges = n.match(/\bges\s*([a-g])\b/);
  if (ges) draft.ges = (ges[1] ?? '').toUpperCase();

  const forts: string[] = [];
  const faibles: string[] = [];
  for (const mot of FORTS) {
    if (n.includes(norm(mot))) forts.push(mot === 'renove' || mot === 'renovee' ? 'rénové' : mot);
  }
  for (const mot of FAIBLES) {
    if (n.includes(norm(mot))) faibles.push(mot);
  }
  draft.pointsForts = unique(forts);
  draft.pointsFaibles = unique(faibles);

  return draft;
}
