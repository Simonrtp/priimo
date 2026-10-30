/**
 * Dictée d'un contact : « Sophie Dubois, vendeuse, 06 12 34 56 78, 12 rue
 * Oberkampf, rappeler jeudi » → les champs de la fiche.
 *
 * Le téléphone et l'e-mail se lisent sans modèle, au fil de la dictée ; le
 * reste (nom, rôles, adresse, critères, résumé) passe par Mistral. Jamais le
 * consentement : « le numéro peut servir à rappeler » est une case que l'agent
 * coche lui-même, après avoir demandé à la personne.
 */

import type { ContactType } from '@/types/contact';
import { normalizePostalCodes, type ContactInputFields } from '@/lib/contact-input';
import { formatPhoneOrNull, normalizePhone } from '@/lib/import/normalize';
import { chatOnce } from '@/lib/assistant/mistral';
import { stableSystemMessage } from '@/lib/assistant/models';
import { resoudreQuand } from '@/lib/notes/date-relative';

/** Ce que la dictée peut remplir : tout sauf le consentement. */
export type ContactVoiceDraft = Partial<Omit<ContactInputFields, 'numeroCommuniqueParLaPersonne'>>;

export const MIN_DICTEE_CONTACT = 8;
const MAX_DICTEE_CONTACT = 3000;

const ROLES: readonly ContactType[] = ['vendeur', 'acquereur', 'locataire', 'gardien', 'commercant', 'autre'];

/* -------------------------------------------------------------------------- */
/* Sans modèle : téléphone et e-mail                                           */
/* -------------------------------------------------------------------------- */

const MOTS_CHIFFRES: Record<string, string> = {
  zéro: '0',
  zero: '0',
  un: '1',
  une: '1',
  deux: '2',
  trois: '3',
  quatre: '4',
  cinq: '5',
  six: '6',
  sept: '7',
  huit: '8',
  neuf: '9',
};

/** « zéro six douze trente-quatre… » est rare ; « 06 12 34 56 78 » est la norme. */
export function telephoneDit(texte: string): string | null {
  const m = /(?<![\d])((?:\+33|0033|0)[\s.\-]?[1-9](?:[\s.\-]?\d{2}){4})(?![\d])/.exec(texte);
  if (m) return formatPhoneOrNull(m[1]!);
  // Chiffres dictés un à un : « zéro six un deux… ».
  const mots = texte.toLocaleLowerCase('fr').split(/[\s,.;:]+/);
  let suite = '';
  for (const mot of mots) {
    const c = MOTS_CHIFFRES[mot] ?? (/^\d{1,2}$/.test(mot) ? mot : null);
    if (c === null) {
      if (normalizePhone(suite).length >= 10) break;
      suite = '';
      continue;
    }
    suite += c;
  }
  const digits = normalizePhone(suite);
  return /^0[1-9]\d{8}$/.test(digits.slice(0, 10)) && digits.length >= 10 ? formatPhoneOrNull(digits.slice(0, 10)) : null;
}

/** « sophie point dubois arobase gmail point com » est lu tel quel par la dictée. */
export function emailDit(texte: string): string | null {
  const t = texte
    .replace(/\s+(?:arobase|at)\s+/gi, '@')
    .replace(/\s+point\s+/gi, '.')
    .replace(/\s+tiret\s+/gi, '-');
  const m = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/.exec(t);
  return m ? m[0].toLocaleLowerCase('fr') : null;
}

/** Ce qu'on lit tout de suite, avant même que le modèle ait répondu. */
export function lectureLocale(texte: string): ContactVoiceDraft {
  const draft: ContactVoiceDraft = {};
  const phone = telephoneDit(texte);
  if (phone) draft.phone = phone;
  const email = emailDit(texte);
  if (email) draft.email = email;
  return draft;
}

/* -------------------------------------------------------------------------- */
/* Avec modèle                                                                 */
/* -------------------------------------------------------------------------- */

export const CONTACT_SYSTEM_PROMPT = [
  "Tu remplis la fiche d'un contact d'agence immobilière à partir de ce que l'agent vient de dicter. Tu réponds uniquement par un objet JSON, sans markdown.",
  "N'invente rien : un champ non dit vaut null. Écris les noms avec majuscule initiale, sans civilité (« Madame Dubois » → nom Dubois).",
  'Schéma : {"prenom":string|null,"nom":string|null,"roles":("vendeur"|"acquereur"|"locataire"|"gardien"|"commercant")[],"telephone":string|null,"email":string|null,"adresse":string|null,"secteur":string|null,"code_postaux":string[],"budget_min":number|null,"budget_max":number|null,"surface_min":number|null,"surface_max":number|null,"pieces_min":number|null,"resume":string|null,"relance_quand":string|null,"relance":"AAAA-MM-JJ"|null}',
  'roles : qui est la personne pour l\'agence. « veut vendre » → vendeur ; « cherche à acheter » → acquereur ; vide si rien n\'est dit. Le premier rôle est le principal.',
  'adresse : l\'adresse postale dite (numéro, voie, ville), telle quelle. secteur : un quartier ou une commune dits (« Belleville », « 11e »), sinon null.',
  'Les critères (budget, surfaces, pieces_min) ne concernent que ce que la personne CHERCHE à acheter ou louer : jamais le bien qu\'elle vend. « un trois pièces pour 420 mille euros » → pieces_min 3, budget_max 420000 (budget_min reste null sauf « entre X et Y »). Surfaces en m², nombres purs.',
  'resume : une ou deux phrases objectives sur la situation de la personne (projet, contraintes), jamais d\'opinion. relance_quand : l\'expression de rappel dite, mot pour mot (« jeudi prochain », « demain matin »), sinon null. relance : seulement si une date précise est dite (« le 12 novembre »).',
].join('\n');

function chaine(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return !s || s.toLowerCase() === 'null' ? null : s.slice(0, max);
}

function nombre(v: unknown, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n) : null;
}

function majuscule(s: string | null): string {
  if (!s) return '';
  return s.replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep: string, c: string) => `${sep}${c.toLocaleUpperCase('fr')}`);
}

/** Lit la réponse du modèle ; tout ce qui est douteux est écarté, jamais deviné. */
export function parseContactVoice(json: string, ref: Date = new Date()): ContactVoiceDraft {
  let obj: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(json.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    obj = parsed as Record<string, unknown>;
  } catch {
    return {};
  }

  const draft: ContactVoiceDraft = {};
  const prenom = chaine(obj.prenom, 80);
  const nom = chaine(obj.nom, 80);
  if (prenom) draft.firstName = majuscule(prenom);
  if (nom) draft.lastName = majuscule(nom);

  const roles = (Array.isArray(obj.roles) ? obj.roles : [])
    .map((r) => (typeof r === 'string' ? (r.toLocaleLowerCase('fr') as ContactType) : null))
    .filter((r): r is ContactType => r !== null && ROLES.includes(r) && r !== 'autre');
  const uniques = [...new Set(roles)];
  if (uniques.length > 0) {
    draft.type = uniques[0]!;
    draft.autresTypes = uniques.slice(1);
  }

  const phone = chaine(obj.telephone, 30);
  const tel = phone ? telephoneDit(phone) : null;
  if (tel) draft.phone = tel;
  const email = chaine(obj.email, 120);
  if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) draft.email = email.toLocaleLowerCase('fr');

  const adresse = chaine(obj.adresse, 200);
  if (adresse) draft.address = adresse;
  const secteur = chaine(obj.secteur, 120);
  if (secteur) draft.secteur = secteur;
  const codes = normalizePostalCodes(obj.code_postaux);
  if (codes.length > 0) draft.postalCodes = codes;

  const budgetMin = nombre(obj.budget_min, 50_000_000);
  const budgetMax = nombre(obj.budget_max, 50_000_000);
  if (budgetMin !== null) draft.budgetMin = budgetMin;
  if (budgetMax !== null) draft.budgetMax = budgetMax;
  const surfaceMin = nombre(obj.surface_min, 5000);
  const surfaceMax = nombre(obj.surface_max, 5000);
  if (surfaceMin !== null) draft.surfaceMin = surfaceMin;
  if (surfaceMax !== null) draft.surfaceMax = surfaceMax;
  const pieces = nombre(obj.pieces_min, 20);
  if (pieces !== null) draft.roomsMin = pieces;

  const resume = chaine(obj.resume, 600);
  if (resume) draft.summary = resume;
  // « jeudi prochain » se calcule ici : les modèles comptent mal les jours.
  const quand = resoudreQuand(chaine(obj.relance_quand, 80), ref);
  const relance = chaine(obj.relance, 10);
  if (quand) draft.recontacterLe = quand.date;
  else if (relance && /^\d{4}-\d{2}-\d{2}$/.test(relance)) draft.recontacterLe = relance;

  return draft;
}

/** Les champs que la dictée a remplis : ce que la fiche signale « à relire ». */
export function champsDuDraft(draft: ContactVoiceDraft): (keyof ContactVoiceDraft)[] {
  return (Object.keys(draft) as (keyof ContactVoiceDraft)[]).filter((k) => {
    const v = draft[k];
    return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== '';
  });
}

/** Un second jet complète le premier sans l'écraser par du vide. */
export function fusionnerDrafts(base: ContactVoiceDraft, ajout: ContactVoiceDraft): ContactVoiceDraft {
  return { ...base, ...ajout };
}

export async function extractContactFields(
  transcript: string,
  apiKey: string,
  aujourdhui: string,
): Promise<ContactVoiceDraft> {
  const texte = transcript.trim().slice(0, MAX_DICTEE_CONTACT);
  if (texte.length < MIN_DICTEE_CONTACT) return {};

  const out = await chatOnce({
    tier: 'tri',
    apiKey,
    maxTokens: 600,
    jsonObject: true,
    timeoutMs: 15_000,
    messages: [
      stableSystemMessage(CONTACT_SYSTEM_PROMPT),
      { role: 'user', content: `Date du jour : ${aujourdhui}\nDictée : ${texte}` },
    ],
  });
  const lu = out ? parseContactVoice(out.texte, new Date()) : {};
  // Ce que le texte dit sans ambiguïté prime sur la lecture du modèle.
  return fusionnerDrafts(lu, lectureLocale(texte));
}
