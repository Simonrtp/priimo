/**
 * Structuration d'une dictée en propositions — l'agent valide ligne par ligne.
 * Rien n'est créé ici.
 */

import { parseIsoDateOnly, parseIsoDateTime, resolvePromesseEcheance, resolveRendezVous } from '@/lib/notes/date-relative';

import type { ContactType, NoteSourceInfo } from '@/types/contact';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
/**
 * Modèles essayés dans l'ordre. `ministral-8b` lit une dictée d'agent aussi
 * bien que `mistral-small` pour une fraction du prix, et reste disponible quand
 * les modèles plus gros rendent 429 sur les petits forfaits. Le repli 3b est
 * moins fidèle — il complète parfois un prénom absent — mais un champ proposé
 * puis corrigé vaut mieux qu'un formulaire vide.
 */
const MODELES = ['ministral-8b-latest', 'ministral-3b-latest'] as const;
const MAX_TRANSCRIPT_CHARS = 2200;
const MIN_TRANSCRIPT_CHARS = 12;
const MAX_OUTPUT_TOKENS = 600;

export type ExtractedPersonne = {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  type: ContactType;
};

export type ExtractedRelance = {
  jours: number;
  libelle: string;
};

export type ExtractedPromesse = {
  intitule: string;
  echeance: string;
};

export type ExtractedRendezVous = {
  debut: string;
  fin: string;
  type: 'visite' | 'estimation' | 'signature' | 'autre';
  lieu: string | null;
};

export type ExtractedVisite = {
  dateVisite: string;
  interet: 'aucun' | 'tiede' | 'chaud' | 'offre' | null;
  retour: string | null;
  contactHint: string | null;
};

export type NoteExtraction = {
  personnes: ExtractedPersonne[];
  address: string | null;
  secteur: string | null;
  prix: number | null;
  rooms: number | null;
  surface: number | null;
  sourceInfo: NoteSourceInfo | null;
  relance: ExtractedRelance | null;
  promesse: ExtractedPromesse | null;
  rendezVous: ExtractedRendezVous | null;
  visite: ExtractedVisite | null;
};

export const EMPTY_NOTE_EXTRACTION: NoteExtraction = {
  personnes: [],
  address: null,
  secteur: null,
  prix: null,
  rooms: null,
  surface: null,
  sourceInfo: null,
  relance: null,
  promesse: null,
  rendezVous: null,
  visite: null,
};

/**
 * Aucun nom propre en exemple dans la consigne : un petit modèle recopie les
 * exemples qu'on lui montre, et un nom inventé dans une fiche contact coûte
 * plus cher en confiance que dix champs laissés vides.
 */
const SYSTEM_PROMPT = [
  "Tu structures la note dictée d'un agent immobilier français. Tu réponds uniquement en JSON.",
  'Ne devine jamais, n’invente aucun nom, aucun chiffre, aucune date.',
  'Tout champ qui n’est pas dit explicitement vaut null. Ne recopie aucun exemple de la consigne.',
  'Les valeurs d’énumération s’écrivent exactement comme listées, en minuscules et sans accent.',
].join(' ');

function buildPrompt(transcript: string, noteDate = new Date()): string {
  const ref = noteDate.toISOString().slice(0, 10);
  // Le jour de la semaine coûte trois jetons et évite de compter « jeudi » de
  // travers : sans lui, le modèle place la relance à peu près n'importe quand.
  const jour = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    timeZone: 'Europe/Paris',
  }).format(noteDate);
  return [
    `Note dictée le ${ref} (${jour}) :`,
    transcript,
    '',
    'Renvoie ce JSON, mêmes clés, mêmes formes :',
    '{',
    '  "personnes": [{"firstName": string|null, "lastName": string|null, "phone": string|null, "email": string|null, "type": "vendeur"|"acquereur"|"locataire"|"gardien"|"commercant"|"autre"}],',
    '  "address": string|null,',
    '  "secteur": string|null,',
    '  "prix": number|null,',
    '  "rooms": number|null,',
    '  "surface": number|null,',
    '  "source_info": "proprietaire"|"gardien"|"voisin"|"tiers"|"agent"|null,',
    '  "relance_jours": number|null,',
    '  "relance_libelle": string|null,',
    '  "promesse": {"intitule": string, "echeance_iso": "AAAA-MM-JJ"}|null,',
    '  "rendez_vous": {"debut_iso": "AAAA-MM-JJTHH:MM", "fin_iso": "AAAA-MM-JJTHH:MM", "type": "visite"|"estimation"|"signature"|"autre", "lieu": string|null}|null,',
    '  "visite": {"date_iso": "AAAA-MM-JJTHH:MM", "interet": "aucun"|"tiede"|"chaud"|"offre"|null, "retour": string|null, "contact_hint": string|null}|null',
    '}',
    '',
    'Précisions :',
    '- "address" est UNE chaîne, l’adresse telle qu’elle est dite, jamais un objet.',
    '- "secteur" est le quartier ou l’arrondissement seul.',
    '- "personnes" est toujours un tableau, vide s’il n’y a aucun nom. Une personne sans nom ni téléphone ne compte pas.',
    '- "rendez_vous" et "visite" sont des objets uniques ou null, jamais des tableaux.',
    `- Dates relatives (jeudi, mardi 15h, dans deux semaines) → date absolue calculée depuis le ${ref}, qui est un ${jour}. « Jeudi » sans autre précision désigne le prochain jeudi.`,
    '- "prix" en euros, nombre entier. "rooms" = nombre de pièces (T2 = 2). "surface" en m².',
    '- "source_info" = qui a donné l’information.',
  ].join('\n');
}

function asString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === 'null') return null;
  return s.slice(0, max);
}

/** Minuscules sans accent : « Propriétaire » et « acquéreur » retombent sur l'énuméré. */
function sansAccent(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .trim();
  return s && s !== 'null' ? s : null;
}

/**
 * Un modèle qui rend `{street, city}` au lieu d'une chaîne n'a pas mal compris
 * la note : il a mal compris la consigne. On recolle plutôt que de tout perdre.
 */
function asAdresse(v: unknown): string | null {
  const direct = asString(v, 240);
  if (direct) return direct;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const row = v as Record<string, unknown>;
  const morceaux = [
    asString(row.number, 12) ?? asString(row.buildingNumber, 12),
    asString(row.street, 200) ?? asString(row.voie, 200) ?? asString(row.rue, 200),
    asString(row.postalCode, 12) ?? asString(row.zip, 12) ?? asString(row.codePostal, 12),
    asString(row.city, 80) ?? asString(row.ville, 80),
  ].filter(Boolean);
  if (morceaux.length === 0) return null;
  // Le numéro est souvent déjà dans « street » : on ne le répète pas.
  const recolle = morceaux.join(' ').replace(/\s+/g, ' ').trim();
  return recolle.slice(0, 240);
}

/** Un objet attendu seul arrive parfois en tableau d'un élément. */
function objetUnique(v: unknown): Record<string, unknown> | null {
  const candidat = Array.isArray(v) ? v[0] : v;
  if (!candidat || typeof candidat !== 'object' || Array.isArray(candidat)) return null;
  return candidat as Record<string, unknown>;
}

/** « catherine de villeneuve » → « Catherine de Villeneuve ». */
function capitaliserNom(raw: string): string {
  return raw
    .split(/([\s’'-])/u)
    .map((part) => {
      if (!part || /[\s’'-]/.test(part)) return part;
      // Les particules restent en minuscule quand elles ne commencent pas le nom.
      if (PARTICULES.has(part.toLocaleLowerCase('fr'))) return part.toLocaleLowerCase('fr');
      return part.charAt(0).toLocaleUpperCase('fr') + part.slice(1).toLocaleLowerCase('fr');
    })
    .join('');
}

const PARTICULES = new Set(['de', 'du', 'des', 'la', 'le', 'van', 'von', 'da', 'di', "d'", 'l’']);

/**
 * Mots que le modèle glisse dans un nom quand la note ne nomme personne
 * (« le gardien du 24 » → lastName: "gardien"). Un rôle n'est pas un patronyme.
 */
const ROLES = new Set([
  'gardien',
  'gardienne',
  'proprietaire',
  'proprietaires',
  'voisin',
  'voisine',
  'locataire',
  'vendeur',
  'vendeuse',
  'acquereur',
  'acheteur',
  'client',
  'cliente',
  'syndic',
  'agent',
  'monsieur',
  'madame',
  'inconnu',
  'inconnue',
  'personne',
]);

function estRole(raw: string): boolean {
  return ROLES.has(sansAccent(raw) ?? '');
}

function asInt(v: unknown, max: number): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max) return Math.round(v);
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d]/g, ''));
    if (Number.isFinite(n) && n > 0 && n <= max) return Math.round(n);
  }
  return null;
}

/** T2 → 2, « 3 pièces » → 3. */
export function asRooms(v: unknown): number | null {
  if (typeof v === 'string') {
    const t = v.trim().toUpperCase().match(/^T\s*(\d{1,2})$/);
    if (t) return asInt(Number(t[1]), 50);
  }
  return asInt(v, 50);
}

export function lignesFicheNote(
  e: Pick<NoteExtraction, 'address' | 'secteur' | 'prix' | 'rooms' | 'surface'>,
): string[] {
  const bits: string[] = [];
  if (e.rooms) bits.push(e.rooms <= 7 ? `T${e.rooms}` : `${e.rooms} pièces`);
  if (e.surface) bits.push(`${e.surface} m²`);
  if (e.prix) bits.push(`${new Intl.NumberFormat('fr-FR').format(e.prix)} €`);
  const lignes: string[] = [];
  if (bits.length) lignes.push(bits.join(' · '));
  const lieu = [e.address, e.secteur].filter(Boolean).join(' · ');
  if (lieu) lignes.push(lieu);
  return lignes;
}

const TYPES: readonly ContactType[] = [
  'vendeur',
  'acquereur',
  'locataire',
  'gardien',
  'commercant',
  'autre',
];
const SOURCES: readonly NoteSourceInfo[] = ['proprietaire', 'gardien', 'voisin', 'tiers', 'agent'];

function parsePersonne(raw: unknown): ExtractedPersonne | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const brutPrenom = asString(row.firstName, 80) ?? '';
  const brutNom = asString(row.lastName, 80) ?? '';
  const phone = asString(row.phone, 40);
  // Un rôle cité sans patronyme ne fait pas un contact : « le gardien » reste
  // dans la note, il n'atterrit pas dans le carnet d'adresses.
  const firstName = estRole(brutPrenom) ? '' : brutPrenom;
  const lastName = estRole(brutNom) ? '' : brutNom;
  if (!firstName && !lastName && !phone) return null;
  const typeRaw = sansAccent(row.type) ?? 'autre';
  const type = (TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as ContactType) : 'autre';
  return {
    firstName: firstName ? capitaliserNom(firstName) : '',
    lastName: lastName ? capitaliserNom(lastName) : '',
    phone,
    email: asString(row.email, 160),
    type,
  };
}

export function parseNoteExtraction(raw: string, refDate = new Date()): NoteExtraction {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ...EMPTY_NOTE_EXTRACTION, personnes: [] };
  }

  const personnesRaw = Array.isArray(parsed.personnes)
    ? parsed.personnes
    : parsed.personnes
      ? [parsed.personnes]
      : [];
  const personnes = personnesRaw.map(parsePersonne).filter((p): p is ExtractedPersonne => p !== null);

  const sourceRaw = sansAccent(parsed.source_info);
  const sourceInfo =
    sourceRaw && (SOURCES as readonly string[]).includes(sourceRaw)
      ? (sourceRaw as NoteSourceInfo)
      : null;

  const jours = asInt(parsed.relance_jours, 365);
  const libelle = asString(parsed.relance_libelle, 160);
  const relance = jours ? { jours, libelle: libelle ?? `Relancer dans ${jours} jours` } : null;

  let promesse: ExtractedPromesse | null = null;
  const promRaw = objetUnique(parsed.promesse);
  if (promRaw) {
    const intitule = asString(promRaw.intitule, 200);
    const echeance =
      parseIsoDateOnly(promRaw.echeance_iso) ??
      parseIsoDateOnly(promRaw.echeance) ??
      (intitule ? resolvePromesseEcheance(intitule, refDate) : null);
    if (intitule && echeance) promesse = { intitule, echeance };
  }

  let rendezVous: ExtractedRendezVous | null = null;
  const rdvRaw = objetUnique(parsed.rendez_vous) ?? objetUnique(parsed.rdv);
  if (rdvRaw) {
    const debut = parseIsoDateTime(rdvRaw.debut_iso) ?? parseIsoDateTime(rdvRaw.debut);
    // Une heure de fin manquante ne doit pas faire disparaître le rendez-vous :
    // une visite dure une heure par défaut, l'agent corrige s'il le faut.
    const fin =
      parseIsoDateTime(rdvRaw.fin_iso) ??
      parseIsoDateTime(rdvRaw.fin) ??
      (debut ? new Date(Date.parse(debut) + 3_600_000).toISOString() : null);
    const typeRaw = sansAccent(rdvRaw.type) ?? 'autre';
    const type = (['visite', 'estimation', 'signature', 'autre'] as const).includes(typeRaw as 'visite')
      ? (typeRaw as ExtractedRendezVous['type'])
      : 'autre';
    const lieu = asString(rdvRaw.lieu, 200);
    if (debut && fin) rendezVous = { debut, fin, type, lieu };
  }

  let visite: ExtractedVisite | null = null;
  const visRaw = objetUnique(parsed.visite);
  if (visRaw) {
    const dateVisite = parseIsoDateTime(visRaw.date_iso) ?? parseIsoDateTime(visRaw.date);
    const retour = asString(visRaw.retour, 500);
    const contactHint = asString(visRaw.contact_hint, 120);
    const interetRaw = sansAccent(visRaw.interet);
    const interet =
      interetRaw && (['aucun', 'tiede', 'chaud', 'offre'] as const).includes(interetRaw as 'aucun')
        ? (interetRaw as ExtractedVisite['interet'])
        : null;
    if (dateVisite) visite = { dateVisite, interet, retour, contactHint };
  }

  return {
    personnes,
    address: asAdresse(parsed.address),
    secteur: asString(parsed.secteur, 160),
    prix: asInt(parsed.prix, 100_000_000),
    rooms: asRooms(parsed.rooms),
    surface: asInt(parsed.surface, 100_000),
    sourceInfo,
    relance,
    promesse,
    rendezVous,
    visite,
  };
}

/** Modèles à essayer : celui imposé par l'environnement, puis la liste par défaut. */
function modelesAEssayer(): readonly string[] {
  const impose = process.env.MISTRAL_MODEL_NOTE?.trim();
  if (!impose) return MODELES;
  return [impose, ...MODELES.filter((m) => m !== impose)];
}

async function demander(
  model: string,
  apiKey: string,
  transcript: string,
  noteDate: Date,
): Promise<string | null> {
  const res = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(transcript, noteDate) },
      ],
    }),
  });

  if (res.status === 429 || res.status >= 500) {
    // Quota ou incident : le modèle suivant de la liste prend le relais.
    console.error('[voice] propositions', model, res.status);
    return null;
  }
  if (!res.ok) {
    console.error('[voice] propositions HTTP', res.status, await res.text().catch(() => ''));
    throw new Error('extraction_failed');
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return body.choices?.[0]?.message?.content ?? null;
}

export async function extractNotePropositions(
  transcript: string,
  apiKey: string,
  noteDate = new Date(),
): Promise<NoteExtraction> {
  const trimmed = transcript.trim();
  if (trimmed.length < MIN_TRANSCRIPT_CHARS) return { ...EMPTY_NOTE_EXTRACTION, personnes: [] };

  const capped =
    trimmed.length > MAX_TRANSCRIPT_CHARS ? trimmed.slice(0, MAX_TRANSCRIPT_CHARS) : trimmed;

  for (const model of modelesAEssayer()) {
    const content = await demander(model, apiKey, capped, noteDate);
    if (content) return parseNoteExtraction(content, noteDate);
  }
  throw new Error('extraction_empty');
}

export function relanceAtFromJours(jours: number, now = new Date()): string {
  const at = new Date(now.getTime() + jours * 86_400_000);
  return at.toISOString();
}
