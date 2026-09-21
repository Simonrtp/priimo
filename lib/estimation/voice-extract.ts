/**
 * Extraction d'une dictée vers les champs du formulaire d'estimation.
 * Propose uniquement ce qui a été dit. Ne devine jamais. Ne touche pas à l'adresse.
 */

import { SOUS_TYPES_BIEN } from '@/lib/estimation/sous-types';
import { inferDernierEtage, VALEURS_ETAGE } from '@/lib/estimation/etages';
import { CRITERE_NOTE_LABELS } from '@/lib/estimation/grille';
import type { EstimationAnnexe, EstimationBien, EstimationObjet } from '@/lib/estimation/objet';
import type { EstimationOccupation } from '@/lib/estimation/cycle';
import { extractEstimationHeuristic } from '@/lib/estimation/voice-heuristic';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';
const MAX_TRANSCRIPT_CHARS = 3200;
const MIN_TRANSCRIPT_CHARS = 12;
const MAX_OUTPUT_TOKENS = 800;

const SYSTEM_PROMPT =
  'Tu ranges une description LIBRE d’un bien visité (FR), dite comme à un collègue : pas d’ordre, pas de noms de champs. JSON strict. Null ou [] seulement si vraiment absent. T3/F3/studio → rooms + propertyType appartement. Une surface en m² → surfaceM2. Ne devine pas un chiffre non dit. Jamais d’adresse. Un style (haussmannien, art déco, années 30…) n’est PAS une année : mets-le dans pointsForts. anneeConstruction seulement si une année chiffrée est dite. Qualitatif (lumineux, moulures, calme, sombre) → pointsForts, pointsFaibles ou commentairesPublics.';

function buildPrompt(transcript: string): string {
  return `Description libre, dans le désordre :\n${transcript}\n\nRange chaque élément au bon champ. L’agent n’a pas à nommer les champs. Un T3 de 65 m² au 3e avec cave doit remplir rooms, surfaceM2, floor, annexes.\n\nJSON:{propertyType:appartement|maison|null,sousType,rooms,chambres,surfaceM2,carrez:true|false|null,surfaceTerrain,niveaux,floor,etagesImmeuble,dernierEtage:true|false|null,anneeConstruction:number|null,qualiteEmplacement,ascenseur:true|false|null,balconTerrasse:true|false|null,occupation:libre|occupe|null,loyerAnnuel,chargesAnnuelles,chargesCopro,taxeFonciere,annexes:[{libelle,surfaceM2,valorisationEur}],dpeClass,ges,consoKwh,dpeVersion,pointsForts:[],pointsFaibles:[],commentairesPublics}`;
}

function extractJsonObject(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

/** Mistral peut renvoyer une string, un objet, ou des parts [{text}]. */
export function modelContentToJson(content: unknown): string {
  if (typeof content === 'string') return extractJsonObject(content);
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String(part.text ?? '');
        return '';
      })
      .join('');
    return extractJsonObject(text);
  }
  if (content && typeof content === 'object') return JSON.stringify(content);
  return '';
}

function prefer<T>(primary: T | null, fallback: T | null): T | null {
  return primary != null && primary !== '' ? primary : fallback;
}

export function mergeEstimationVoiceDrafts(
  primary: EstimationVoiceDraft,
  fallback: EstimationVoiceDraft,
): EstimationVoiceDraft {
  const annexes = [...primary.annexes];
  for (const extra of fallback.annexes) {
    if (!annexes.some((a) => a.libelle === extra.libelle)) annexes.push(extra);
  }
  return {
    propertyType: prefer(primary.propertyType, fallback.propertyType),
    sousType: prefer(primary.sousType, fallback.sousType),
    rooms: prefer(primary.rooms, fallback.rooms),
    chambres: prefer(primary.chambres, fallback.chambres),
    surfaceM2: prefer(primary.surfaceM2, fallback.surfaceM2),
    carrez: prefer(primary.carrez, fallback.carrez),
    surfaceTerrain: prefer(primary.surfaceTerrain, fallback.surfaceTerrain),
    niveaux: prefer(primary.niveaux, fallback.niveaux),
    floor: prefer(primary.floor, fallback.floor),
    etagesImmeuble: prefer(primary.etagesImmeuble, fallback.etagesImmeuble),
    dernierEtage: prefer(primary.dernierEtage, fallback.dernierEtage),
    anneeConstruction: prefer(primary.anneeConstruction, fallback.anneeConstruction),
    qualiteEmplacement: prefer(primary.qualiteEmplacement, fallback.qualiteEmplacement),
    ascenseur: prefer(primary.ascenseur, fallback.ascenseur),
    balconTerrasse: prefer(primary.balconTerrasse, fallback.balconTerrasse),
    occupation: prefer(primary.occupation, fallback.occupation),
    loyerAnnuel: prefer(primary.loyerAnnuel, fallback.loyerAnnuel),
    chargesAnnuelles: prefer(primary.chargesAnnuelles, fallback.chargesAnnuelles),
    chargesCopro: prefer(primary.chargesCopro, fallback.chargesCopro),
    taxeFonciere: prefer(primary.taxeFonciere, fallback.taxeFonciere),
    annexes,
    dpeClass: prefer(primary.dpeClass, fallback.dpeClass),
    ges: prefer(primary.ges, fallback.ges),
    consoKwh: prefer(primary.consoKwh, fallback.consoKwh),
    dpeVersion: prefer(primary.dpeVersion, fallback.dpeVersion),
    pointsForts: unique([...primary.pointsForts, ...fallback.pointsForts]),
    pointsFaibles: unique([...primary.pointsFaibles, ...fallback.pointsFaibles]),
    commentairesPublics: prefer(primary.commentairesPublics, fallback.commentairesPublics),
  };
}

export type EstimationVoiceField =
  | 'propertyType'
  | 'sousType'
  | 'rooms'
  | 'chambres'
  | 'surfaceM2'
  | 'carrez'
  | 'surfaceTerrain'
  | 'niveaux'
  | 'floor'
  | 'etagesImmeuble'
  | 'dernierEtage'
  | 'anneeConstruction'
  | 'qualiteEmplacement'
  | 'ascenseur'
  | 'balconTerrasse'
  | 'occupation'
  | 'loyerAnnuel'
  | 'chargesAnnuelles'
  | 'chargesCopro'
  | 'taxeFonciere'
  | 'annexes'
  | 'dpeClass'
  | 'ges'
  | 'consoKwh'
  | 'dpeVersion'
  | 'pointsForts'
  | 'pointsFaibles'
  | 'commentairesPublics';

export const CHIFFRES_A_CONFIRMER: ReadonlySet<EstimationVoiceField> = new Set([
  'rooms',
  'chambres',
  'surfaceM2',
  'surfaceTerrain',
  'niveaux',
  'etagesImmeuble',
  'anneeConstruction',
  'loyerAnnuel',
  'chargesAnnuelles',
  'chargesCopro',
  'taxeFonciere',
  'annexes',
  'consoKwh',
]);

export type EstimationVoiceAnnexe = {
  libelle: string;
  surfaceM2: number | null;
  valorisationEur: number | null;
};

export type EstimationVoiceDraft = {
  propertyType: 'appartement' | 'maison' | null;
  sousType: string | null;
  rooms: number | null;
  chambres: number | null;
  surfaceM2: number | null;
  carrez: boolean | null;
  surfaceTerrain: number | null;
  niveaux: number | null;
  floor: string | null;
  etagesImmeuble: number | null;
  dernierEtage: boolean | null;
  anneeConstruction: number | null;
  qualiteEmplacement: string | null;
  ascenseur: boolean | null;
  balconTerrasse: boolean | null;
  occupation: EstimationOccupation | null;
  loyerAnnuel: number | null;
  chargesAnnuelles: number | null;
  chargesCopro: number | null;
  taxeFonciere: number | null;
  annexes: EstimationVoiceAnnexe[];
  dpeClass: string | null;
  ges: string | null;
  consoKwh: number | null;
  dpeVersion: string | null;
  pointsForts: string[];
  pointsFaibles: string[];
  commentairesPublics: string | null;
};

export const EMPTY_ESTIMATION_VOICE: EstimationVoiceDraft = {
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

const ANNEXES_CANON = ['Cave', 'Parking', 'Terrasse', 'Box'] as const;

/** Année uniquement si un millésime est dit — jamais un style architectural. */
export function parseAnneeConstruction(v: unknown): number | null {
  const max = new Date().getFullYear();
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1800 && v <= max) return v;
  if (typeof v !== 'string') return null;
  const hit = v.match(/\b(1[89]\d{2}|20[0-2]\d)\b/);
  if (!hit) return null;
  const y = Number(hit[1]);
  return y >= 1800 && y <= max ? y : null;
}

function asInt(v: unknown, max: number): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max) return Math.round(v);
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (Number.isFinite(n) && n >= 0 && n <= max) return Math.round(n);
  }
  return null;
}

function asString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === 'null') return null;
  return s.slice(0, max);
}

function asBool(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (['oui', 'true', '1', 'avec'].includes(s)) return true;
  if (['non', 'false', '0', 'sans'].includes(s)) return false;
  return null;
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePropertyType(v: unknown): 'appartement' | 'maison' | null {
  const s = asString(v, 40)?.toLocaleLowerCase('fr');
  if (!s) return null;
  if (s.includes('appart')) return 'appartement';
  if (s.includes('maison') || s.includes('villa') || s.includes('pavillon')) return 'maison';
  return null;
}

function parseSousType(v: unknown): string | null {
  const raw = asString(v, 80);
  if (!raw) return null;
  const n = norm(raw);
  const exact = SOUS_TYPES_BIEN.find((t) => norm(t) === n);
  if (exact) return exact;
  const partiel = SOUS_TYPES_BIEN.find((t) => norm(t).includes(n) || n.includes(norm(t)));
  return partiel ?? null;
}

export function parseFloor(v: unknown): string | null {
  const raw = asString(v, 24);
  if (!raw) return null;
  const nrm = norm(raw);
  if (VALEURS_ETAGE.includes(raw as (typeof VALEURS_ETAGE)[number])) return raw;
  if (/rdc|rez de chaussee|rez-de-chaussee|rez de chaussée/.test(nrm) || nrm === '0') return 'RDC';
  if (/20/.test(nrm) && /(\+|plus)/.test(nrm)) return '20+';
  const digits = raw.replace(/\D/g, '');
  const n = Number(digits);
  if (n >= 20) return '20+';
  if (n >= 1 && n <= 19) return String(n);
  return null;
}

function parseQualite(v: unknown): string | null {
  const raw = asString(v, 40);
  if (!raw) return null;
  const n = norm(raw);
  const labels = Object.values(CRITERE_NOTE_LABELS);
  const exact = labels.find((l) => norm(l) === n);
  if (exact) return exact;
  const parTaille = [...labels].sort((a, b) => norm(b).length - norm(a).length);
  return parTaille.find((l) => n.includes(norm(l))) ?? null;
}

function parseDpeLetter(v: unknown): string | null {
  const raw = asString(v, 8);
  if (!raw) return null;
  const letter = raw.trim().toUpperCase().replace(/[^A-G]/g, '').slice(0, 1);
  return /[A-G]/.test(letter) ? letter : null;
}

function parseOccupation(v: unknown): EstimationOccupation | null {
  const s = asString(v, 24)?.toLocaleLowerCase('fr');
  if (!s) return null;
  if (s.includes('occup') || s.includes('locat') || s.includes('loué') || s.includes('loue')) {
    return 'occupe';
  }
  if (s.includes('libre') || s.includes('vacant')) return 'libre';
  return null;
}

function parseAnnexeLibelle(v: unknown): string | null {
  const raw = asString(v, 40);
  if (!raw) return null;
  const n = norm(raw);
  if (n.includes('cave')) return 'Cave';
  if (n.includes('box')) return 'Box';
  if (n.includes('terrasse') || n.includes('balcon')) return 'Terrasse';
  if (n.includes('parking') || n.includes('garage') || n.includes('stationnement')) return 'Parking';
  return ANNEXES_CANON.find((a) => norm(a) === n) ?? null;
}

function parseAnnexes(raw: unknown): EstimationVoiceAnnexe[] {
  if (!Array.isArray(raw)) return [];
  const out: EstimationVoiceAnnexe[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const libelle = parseAnnexeLibelle(o.libelle);
    if (!libelle) continue;
    if (out.some((a) => a.libelle === libelle)) continue;
    out.push({
      libelle,
      surfaceM2: asInt(o.surfaceM2, 10_000),
      valorisationEur: asInt(o.valorisationEur, 10_000_000),
    });
  }
  return out;
}

function parseListe(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = asString(item, 180);
    if (s && !out.includes(s)) out.push(s);
  }
  return out.slice(0, 12);
}

export function parseEstimationVoice(raw: string): EstimationVoiceDraft {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
  } catch (err) {
    console.warn('[estimation] dictée parse JSON', {
      err: err instanceof Error ? err.message : String(err),
      raw,
    });
    return { ...EMPTY_ESTIMATION_VOICE };
  }

  return {
    propertyType: parsePropertyType(parsed.propertyType),
    sousType: parseSousType(parsed.sousType),
    rooms: asInt(parsed.rooms, 30),
    chambres: asInt(parsed.chambres, 20),
    surfaceM2: asInt(parsed.surfaceM2, 10_000),
    carrez: asBool(parsed.carrez),
    surfaceTerrain: asInt(parsed.surfaceTerrain, 1_000_000),
    niveaux: asInt(parsed.niveaux, 12),
    floor: parseFloor(parsed.floor),
    etagesImmeuble: asInt(parsed.etagesImmeuble, 40),
    dernierEtage: asBool(parsed.dernierEtage),
    anneeConstruction: parseAnneeConstruction(parsed.anneeConstruction),
    qualiteEmplacement: parseQualite(parsed.qualiteEmplacement),
    ascenseur: asBool(parsed.ascenseur),
    balconTerrasse: asBool(parsed.balconTerrasse),
    occupation: parseOccupation(parsed.occupation),
    loyerAnnuel: asInt(parsed.loyerAnnuel, 10_000_000),
    chargesAnnuelles: asInt(parsed.chargesAnnuelles, 10_000_000),
    chargesCopro: asInt(parsed.chargesCopro, 10_000_000),
    taxeFonciere: asInt(parsed.taxeFonciere, 10_000_000),
    annexes: parseAnnexes(parsed.annexes),
    dpeClass: parseDpeLetter(parsed.dpeClass),
    ges: parseDpeLetter(parsed.ges),
    consoKwh: asInt(parsed.consoKwh, 2_000),
    dpeVersion: asString(parsed.dpeVersion, 20),
    pointsForts: parseListe(parsed.pointsForts),
    pointsFaibles: parseListe(parsed.pointsFaibles),
    commentairesPublics: asString(parsed.commentairesPublics, 2000),
  };
}

export function voiceDraftKeys(draft: EstimationVoiceDraft): EstimationVoiceField[] {
  const keys: EstimationVoiceField[] = [];
  const scalar: EstimationVoiceField[] = [
    'propertyType',
    'sousType',
    'rooms',
    'chambres',
    'surfaceM2',
    'carrez',
    'surfaceTerrain',
    'niveaux',
    'floor',
    'etagesImmeuble',
    'dernierEtage',
    'anneeConstruction',
    'qualiteEmplacement',
    'ascenseur',
    'balconTerrasse',
    'occupation',
    'loyerAnnuel',
    'chargesAnnuelles',
    'chargesCopro',
    'taxeFonciere',
    'dpeClass',
    'ges',
    'consoKwh',
    'dpeVersion',
    'commentairesPublics',
  ];
  for (const key of scalar) {
    if (draft[key] != null && draft[key] !== '') keys.push(key);
  }
  if (draft.annexes.length > 0) keys.push('annexes');
  if (draft.pointsForts.length > 0) keys.push('pointsForts');
  if (draft.pointsFaibles.length > 0) keys.push('pointsFaibles');
  return keys;
}

function unique(list: string[]): string[] {
  const out: string[] = [];
  for (const item of list) {
    if (item && !out.includes(item)) out.push(item);
  }
  return out;
}

export function applyEstimationVoiceDraft(
  current: EstimationObjet,
  draft: EstimationVoiceDraft,
): { patch: Record<string, unknown>; keys: EstimationVoiceField[] } {
  const keys: EstimationVoiceField[] = [];
  const patch: Record<string, unknown> = {};
  const bien: EstimationBien = { ...current.bien };

  if (draft.propertyType) {
    patch.propertyType = draft.propertyType;
    keys.push('propertyType');
  }
  if (draft.rooms != null) {
    patch.rooms = draft.rooms;
    keys.push('rooms');
  }
  if (draft.surfaceM2 != null) {
    patch.surfaceM2 = draft.surfaceM2;
    keys.push('surfaceM2');
  }
  if (draft.floor) {
    patch.floor = draft.floor;
    keys.push('floor');
  }
  if (draft.occupation) {
    patch.occupation = draft.occupation;
    keys.push('occupation');
  }
  if (draft.loyerAnnuel != null) {
    patch.loyerAnnuel = draft.loyerAnnuel;
    keys.push('loyerAnnuel');
  }
  if (draft.dpeClass) {
    patch.dpeClass = draft.dpeClass;
    keys.push('dpeClass');
  }
  if (draft.commentairesPublics) {
    const deja = current.commentairesPublics?.trim() ?? '';
    patch.commentairesPublics = deja
      ? `${deja}\n${draft.commentairesPublics}`
      : draft.commentairesPublics;
    keys.push('commentairesPublics');
  }

  if (draft.sousType) {
    bien.sousType = draft.sousType;
    keys.push('sousType');
  }
  if (draft.chambres != null) {
    bien.chambres = draft.chambres;
    keys.push('chambres');
  }
  if (draft.carrez != null) {
    bien.carrez = draft.carrez;
    keys.push('carrez');
  }
  if (draft.surfaceTerrain != null) {
    bien.surfaceTerrain = draft.surfaceTerrain;
    keys.push('surfaceTerrain');
  }
  if (draft.niveaux != null) {
    bien.niveaux = draft.niveaux;
    keys.push('niveaux');
  }
  if (draft.etagesImmeuble != null) {
    bien.etagesImmeuble = draft.etagesImmeuble;
    keys.push('etagesImmeuble');
  }
  if (draft.dernierEtage != null) {
    bien.dernierEtage = draft.dernierEtage;
    keys.push('dernierEtage');
  }
  if (draft.anneeConstruction != null) {
    bien.anneeConstruction = draft.anneeConstruction;
    keys.push('anneeConstruction');
  }

  const floorFinal = typeof patch.floor === 'string' ? patch.floor : current.floor;
  const dernierCalcule = inferDernierEtage(floorFinal, bien.etagesImmeuble);
  if (dernierCalcule != null && bien.dernierEtage !== dernierCalcule) {
    bien.dernierEtage = dernierCalcule;
    if (!keys.includes('dernierEtage')) keys.push('dernierEtage');
  }
  if (draft.qualiteEmplacement) {
    bien.qualiteEmplacement = draft.qualiteEmplacement;
    keys.push('qualiteEmplacement');
  }
  if (draft.ascenseur != null) {
    bien.ascenseur = draft.ascenseur;
    keys.push('ascenseur');
  }
  if (draft.balconTerrasse != null) {
    bien.balconTerrasse = draft.balconTerrasse;
    keys.push('balconTerrasse');
  }
  if (draft.chargesAnnuelles != null) {
    bien.chargesAnnuelles = draft.chargesAnnuelles;
    keys.push('chargesAnnuelles');
  }
  if (draft.chargesCopro != null) {
    bien.chargesCopro = draft.chargesCopro;
    keys.push('chargesCopro');
  }
  if (draft.taxeFonciere != null) {
    bien.taxeFonciere = draft.taxeFonciere;
    keys.push('taxeFonciere');
  }
  if (draft.ges) {
    bien.ges = draft.ges;
    keys.push('ges');
  }
  if (draft.consoKwh != null) {
    bien.consoKwh = draft.consoKwh;
    keys.push('consoKwh');
  }
  if (draft.dpeVersion) {
    bien.dpeVersion = draft.dpeVersion;
    keys.push('dpeVersion');
  }

  const bienTouche = keys.some((k) =>
    [
      'sousType',
      'chambres',
      'carrez',
      'surfaceTerrain',
      'niveaux',
      'etagesImmeuble',
      'dernierEtage',
      'anneeConstruction',
      'qualiteEmplacement',
      'ascenseur',
      'balconTerrasse',
      'chargesAnnuelles',
      'chargesCopro',
      'taxeFonciere',
      'ges',
      'consoKwh',
      'dpeVersion',
    ].includes(k),
  );
  if (bienTouche) patch.bien = bien;

  if (draft.annexes.length > 0) {
    const next: EstimationAnnexe[] = current.annexes.map((a) => ({ ...a }));
    let annexesTouchees = false;
    for (const a of draft.annexes) {
      const exist = next.find(
        (x) => x.libelle.toLocaleLowerCase('fr') === a.libelle.toLocaleLowerCase('fr'),
      );
      if (exist) {
        if (a.surfaceM2 != null && exist.surfaceM2 == null) {
          exist.surfaceM2 = a.surfaceM2;
          annexesTouchees = true;
        }
        if (a.valorisationEur != null && exist.valorisationEur == null) {
          exist.valorisationEur = a.valorisationEur;
          annexesTouchees = true;
        }
        continue;
      }
      next.push({
        id: crypto.randomUUID(),
        libelle: a.libelle,
        surfaceM2: a.surfaceM2,
        valorisationEur: a.valorisationEur,
      });
      annexesTouchees = true;
    }
    if (annexesTouchees) {
      patch.annexes = next;
      keys.push('annexes');
    }
  }

  if (draft.pointsForts.length > 0) {
    const next = unique([...current.pointsForts, ...draft.pointsForts]);
    if (next.join('\0') !== current.pointsForts.join('\0')) {
      patch.pointsForts = next;
      keys.push('pointsForts');
    }
  }
  if (draft.pointsFaibles.length > 0) {
    const next = unique([...current.pointsFaibles, ...draft.pointsFaibles]);
    if (next.join('\0') !== current.pointsFaibles.join('\0')) {
      patch.pointsFaibles = next;
      keys.push('pointsFaibles');
    }
  }

  return { patch, keys };
}

function finalizeVoiceDraft(transcript: string, model: EstimationVoiceDraft): EstimationVoiceDraft {
  const draft = mergeEstimationVoiceDrafts(model, extractEstimationHeuristic(transcript));
  if (voiceDraftKeys(draft).length === 0) {
    draft.commentairesPublics = transcript.slice(0, 2000);
  }
  console.info('[estimation] dictée draft clés', voiceDraftKeys(draft));
  return draft;
}

export async function extractEstimationFields(
  transcript: string,
  apiKey: string,
): Promise<EstimationVoiceDraft> {
  const trimmed = transcript.trim();
  if (trimmed.length < MIN_TRANSCRIPT_CHARS) return { ...EMPTY_ESTIMATION_VOICE };

  const capped =
    trimmed.length > MAX_TRANSCRIPT_CHARS ? trimmed.slice(0, MAX_TRANSCRIPT_CHARS) : trimmed;
  console.info('[estimation] dictée transcript', { chars: capped.length, text: capped });

  const res = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      temperature: 0,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(capped) },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error('[estimation] dictée HTTP', res.status, errBody);
    return finalizeVoiceDraft(capped, { ...EMPTY_ESTIMATION_VOICE });
  }

  const body = (await res.json()) as {
    choices?: Array<{ finish_reason?: string; message?: { content?: unknown } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  console.info('[estimation] dictée extract brut', {
    finish_reason: body.choices?.[0]?.finish_reason ?? null,
    content_typeof: typeof content,
    content_is_array: Array.isArray(content),
    content,
  });
  const json = modelContentToJson(content);
  const model = json.trim() ? parseEstimationVoice(json) : { ...EMPTY_ESTIMATION_VOICE };
  return finalizeVoiceDraft(capped, model);
}
