/**
 * Structuration d'une dictée en propositions — l'agent valide ligne par ligne.
 * Rien n'est créé ici.
 */

import { parseIsoDateOnly, parseIsoDateTime, resolvePromesseEcheance, resolveRendezVous } from '@/lib/notes/date-relative';

import type { ContactType, NoteSourceInfo } from '@/types/contact';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-small-latest';
const MAX_TRANSCRIPT_CHARS = 2200;
const MIN_TRANSCRIPT_CHARS = 12;
const MAX_OUTPUT_TOKENS = 550;

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

const EMPTY: NoteExtraction = {
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

const SYSTEM_PROMPT =
  'Extrais des propositions depuis une note dictée (agent immo FR). JSON strict. Null si non dit. Ne devine jamais. N’invente aucun fait.';

function buildPrompt(transcript: string, noteDate = new Date()): string {
  const ref = noteDate.toISOString().slice(0, 10);
  return `Note (${ref}):\n${transcript}\n\nJSON:{personnes:[{firstName,lastName,phone,email,type:vendeur|acquereur|locataire|gardien|commercant|autre}],address,secteur,prix,rooms,surface,source_info:proprietaire|gardien|voisin|tiers|agent|null,relance_jours,relance_libelle,promesse:{intitule,echeance_iso},rendez_vous:{debut_iso,fin_iso,type:visite|estimation|signature|autre,lieu},visite:{date_iso,interet:aucun|tiede|chaud|offre|null,retour,contact_hint}}\nDates relatives (jeudi, lundi, dans 2 semaines) → ISO absolu depuis ${ref}. prix en euros. rooms = pièces (T2=2).`;
}

function asString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === 'null') return null;
  return s.slice(0, max);
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
  const firstName = asString(row.firstName, 80) ?? '';
  const lastName = asString(row.lastName, 80) ?? '';
  if (!firstName && !lastName && !asString(row.phone, 40)) return null;
  const typeRaw = typeof row.type === 'string' ? row.type.toLowerCase() : 'autre';
  const type = (TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as ContactType) : 'autre';
  return {
    firstName,
    lastName,
    phone: asString(row.phone, 40),
    email: asString(row.email, 160),
    type,
  };
}

export function parseNoteExtraction(raw: string, refDate = new Date()): NoteExtraction {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { ...EMPTY, personnes: [] };
  }

  const personnesRaw = Array.isArray(parsed.personnes) ? parsed.personnes : [];
  const personnes = personnesRaw.map(parsePersonne).filter((p): p is ExtractedPersonne => p !== null);

  const sourceRaw = typeof parsed.source_info === 'string' ? parsed.source_info.toLowerCase() : null;
  const sourceInfo =
    sourceRaw && (SOURCES as readonly string[]).includes(sourceRaw)
      ? (sourceRaw as NoteSourceInfo)
      : null;

  const jours = asInt(parsed.relance_jours, 365);
  const libelle = asString(parsed.relance_libelle, 160);
  const relance = jours ? { jours, libelle: libelle ?? `Relancer dans ${jours} jours` } : null;

  let promesse: ExtractedPromesse | null = null;
  const promRaw = parsed.promesse && typeof parsed.promesse === 'object' ? (parsed.promesse as Record<string, unknown>) : null;
  if (promRaw) {
    const intitule = asString(promRaw.intitule, 200);
    const echeance =
      parseIsoDateOnly(promRaw.echeance_iso) ??
      parseIsoDateOnly(promRaw.echeance) ??
      (intitule ? resolvePromesseEcheance(intitule, refDate) : null);
    if (intitule && echeance) promesse = { intitule, echeance };
  }

  let rendezVous: ExtractedRendezVous | null = null;
  const rdvRaw =
    (parsed.rendez_vous && typeof parsed.rendez_vous === 'object' ? parsed.rendez_vous : parsed.rdv) as
      | Record<string, unknown>
      | undefined;
  if (rdvRaw && typeof rdvRaw === 'object') {
    const debut = parseIsoDateTime(rdvRaw.debut_iso) ?? parseIsoDateTime(rdvRaw.debut);
    const fin = parseIsoDateTime(rdvRaw.fin_iso) ?? parseIsoDateTime(rdvRaw.fin);
    const typeRaw = asString(rdvRaw.type, 20)?.toLowerCase() ?? 'autre';
    const type = (['visite', 'estimation', 'signature', 'autre'] as const).includes(typeRaw as 'visite')
      ? (typeRaw as ExtractedRendezVous['type'])
      : 'autre';
    const lieu = asString(rdvRaw.lieu, 200);
    if (debut && fin) rendezVous = { debut, fin, type, lieu };
  }

  let visite: ExtractedVisite | null = null;
  const visRaw = parsed.visite && typeof parsed.visite === 'object' ? (parsed.visite as Record<string, unknown>) : null;
  if (visRaw) {
    const dateVisite = parseIsoDateTime(visRaw.date_iso) ?? parseIsoDateTime(visRaw.date);
    const retour = asString(visRaw.retour, 500);
    const contactHint = asString(visRaw.contact_hint, 120);
    const interetRaw = asString(visRaw.interet, 20)?.toLowerCase();
    const interet =
      interetRaw && (['aucun', 'tiede', 'chaud', 'offre'] as const).includes(interetRaw as 'aucun')
        ? (interetRaw as ExtractedVisite['interet'])
        : null;
    if (dateVisite) visite = { dateVisite, interet, retour, contactHint };
  }

  return {
    personnes,
    address: asString(parsed.address, 240),
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

export async function extractNotePropositions(
  transcript: string,
  apiKey: string,
  noteDate = new Date(),
): Promise<NoteExtraction> {
  const trimmed = transcript.trim();
  if (trimmed.length < MIN_TRANSCRIPT_CHARS) return { ...EMPTY, personnes: [] };

  const capped =
    trimmed.length > MAX_TRANSCRIPT_CHARS ? trimmed.slice(0, MAX_TRANSCRIPT_CHARS) : trimmed;

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
        { role: 'user', content: buildPrompt(capped, noteDate) },
      ],
    }),
  });

  if (!res.ok) {
    console.error('[voice] propositions HTTP', res.status, await res.text().catch(() => ''));
    throw new Error('extraction_failed');
  }

  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('extraction_empty');
  return parseNoteExtraction(content, noteDate);
}

export function relanceAtFromJours(jours: number, now = new Date()): string {
  const at = new Date(now.getTime() + jours * 86_400_000);
  return at.toISOString();
}
