import { normalizeName, normalizePhone } from '@/lib/import/normalize';
import { nameTokens, scoreNom } from '@/lib/assistant/nom-match';
import type { ExtractedPersonne } from '@/lib/notes/propositions';
import { matchContacts, type ContactMatch, type MatchableContact } from '@/lib/notes/match';

const VERB =
  "(?:contacter|appeler|joindre|relancer|rappeler|rencontrer|rencontré|voir(?:\\s+avec)?|chez|par|avec|pour|vu|c['’]est|s['’]appelle|nommé)";
const CIVILITE = '(?:m(?:me)?\\.?\\s+|monsieur\\s+|madame\\s+)?';
const NAME_PART = "([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’\\-]{1,39})";

const AFTER_VERB = new RegExp(
  `(?:^|[^A-Za-zÀ-ÿ])${VERB}\\s+${CIVILITE}${NAME_PART}\\s+${NAME_PART}`,
  'giu',
);
const AFTER_CIVILITE = new RegExp(
  `(?:^|[^A-Za-zÀ-ÿ])(?:monsieur|madame|mademoiselle)\\s+${NAME_PART}(?:\\s+${NAME_PART})?`,
  'giu',
);
const CAPITALIZED_PAIR = new RegExp(
  `\\b([A-ZÉÈÊÀÂÎÏÙÛÇ][A-Za-zÀ-ÿ'’\\-]{1,39})\\s+([A-ZÉÈÊÀÂÎÏÙÛÇ][A-Za-zÀ-ÿ'’\\-]{1,39})\\b`,
  'gu',
);
const ADRESSE_FR = new RegExp(
  String.raw`\b(\d{1,4}\s*(?:bis|ter)?\s+(?:rue|avenue|av\.?|boulevard|bd\.?|impasse|place|all[ée]e|chemin|quai|cours|route|passage)\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9'’\-\s]{1,40})`,
  'iu',
);

const GUESS_STOPWORDS = new Set([
  // Une civilité n'est pas un prénom : « Monsieur Bertrand » ne doit pas créer
  // un contact « Monsieur » en plus de celui que l'extraction propose déjà.
  'monsieur',
  'madame',
  'mademoiselle',
  'mr',
  'mme',
  'mlle',
  'il',
  'elle',
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'du',
  'de',
  'son',
  'sa',
  'ses',
  'leur',
  'leurs',
  'ce',
  'cet',
  'cette',
  'ces',
  'mon',
  'ma',
  'mes',
  'ton',
  'ta',
  'tes',
  'nous',
  'vous',
  'on',
  'au',
  'aux',
  'pour',
  'avec',
  'dans',
  'sur',
  'par',
  'qui',
  'que',
  'dont',
  'plus',
  'tout',
  'tous',
  'toute',
  'toutes',
  'faut',
  'faire',
  'voir',
  'chez',
  'info',
  'infos',
  'information',
  'informations',
  'appartement',
  'appart',
  'immeuble',
  'proprio',
  'proprietaire',
  'propriétaire',
  'gardien',
  'voisin',
  'client',
  'dossier',
  'note',
  'rappel',
  'rdv',
  'rendez',
  'vous',
  'syndic',
  'copro',
  'copropriete',
  'copropriété',
  'mobilier',
  'concernant',
  'puisqu',
  'puisque',
]);

function titleCaseNom(raw: string): string {
  return raw
    .split(/([\s’'\-])/u)
    .map((part) => {
      if (!part || /[\s’'\-]/.test(part)) return part;
      return part.charAt(0).toLocaleUpperCase('fr') + part.slice(1).toLocaleLowerCase('fr');
    })
    .join('');
}

function isNamePart(raw: string): boolean {
  const token = normalizeName(raw);
  if (token.length < 2) return false;
  return !GUESS_STOPWORDS.has(token);
}

function asPersonne(first: string, last: string): ExtractedPersonne | null {
  if (!isNamePart(first) || !isNamePart(last)) return null;
  return {
    firstName: titleCaseNom(first.trim()),
    lastName: titleCaseNom(last.trim()),
    phone: null,
    email: null,
    type: 'autre',
  };
}

/**
 * Lit tous les prénoms + noms d’une dictée (« Amélie Jacquet », « par Thomas Perrin »).
 */
export function guessPersonnesFromTranscript(transcript: string): ExtractedPersonne[] {
  const text = transcript.trim();
  if (!text) return [];

  const out: { personne: ExtractedPersonne; index: number }[] = [];
  const seen = new Set<string>();

  function add(first: string, last: string, index: number) {
    const guessed = asPersonne(first, last);
    if (!guessed) return;
    const key = `${normalizeName(guessed.firstName)}|${normalizeName(guessed.lastName)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ personne: guessed, index });
  }

  for (const match of text.matchAll(AFTER_VERB)) {
    if (match[1] && match[2]) add(match[1], match[2], match.index ?? 0);
  }
  for (const match of text.matchAll(AFTER_CIVILITE)) {
    if (match[1] && match[2]) add(match[1], match[2], match.index ?? 0);
    else if (match[1] && isNamePart(match[1])) {
      const last = titleCaseNom(match[1].trim());
      const key = `|${normalizeName(last)}`;
      if (!seen.has(key) && !seen.has(`${normalizeName(last)}|`)) {
        seen.add(key);
        out.push({
          personne: {
            firstName: '',
            lastName: last,
            phone: null,
            email: null,
            type: 'autre',
          },
          index: match.index ?? 0,
        });
      }
    }
  }
  for (const match of text.matchAll(CAPITALIZED_PAIR)) {
    if (match[1] && match[2]) add(match[1], match[2], match.index ?? 0);
  }
  return out.sort((a, b) => a.index - b.index).map((row) => row.personne);
}

export function guessAdresseFromTranscript(transcript: string): string | null {
  const m = transcript.match(ADRESSE_FR);
  if (!m?.[1]) return null;
  return m[1]
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/u, '')
    .trim()
    .slice(0, 240) || null;
}

export function guessPersonneFromTranscript(transcript: string): ExtractedPersonne | null {
  return guessPersonnesFromTranscript(transcript)[0] ?? null;
}

/** Mot présent tel quel dans la dictée, sans attraper un fragment d'un autre mot. */
function motDansTexte(normalise: string, mot: string): boolean {
  if (!mot) return false;
  return new RegExp(`(?:^| )${mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$| )`).test(normalise);
}

/**
 * Garde-fou contre l'invention : un nom ne passe que s'il est réellement
 * prononcé. On compare le texte, pas le résultat d'une seconde devinette —
 * le lecteur de noms ne sait pas voir « Catherine de Villeneuve » (particule)
 * ni un prénom seul (« Monsieur Bertrand »), alors qu'ils sont bien dits.
 */
export function personneCitedInTranscript(
  personne: Pick<ExtractedPersonne, 'firstName' | 'lastName' | 'phone'>,
  transcript: string,
): boolean {
  if (phoneInTranscript(transcript, personne.phone)) return true;
  const texte = ` ${normalizeName(transcript)} `;
  const last = normalizeName(personne.lastName);
  const first = normalizeName(personne.firstName);
  if (!last && !first) return false;
  // Chaque morceau annoncé doit être dans la dictée : un prénom exact avec un
  // patronyme inventé (ou l'inverse) est rejeté.
  if (last && !motDansTexte(texte, last)) return false;
  if (first && !motDansTexte(texte, first)) return false;
  return true;
}

/**
 * Retire d'une personne extraite les morceaux de nom absents de la dictée.
 * « les Lemoine » cité et un prénom ajouté d'office donnent « Lemoine » seul :
 * on garde ce qui a été dit sans rien perdre de ce qui est vrai.
 */
export function recadrerPersonne(
  personne: ExtractedPersonne,
  transcript: string,
): ExtractedPersonne | null {
  if (phoneInTranscript(transcript, personne.phone)) return personne;
  const texte = ` ${normalizeName(transcript)} `;
  const first = motDansTexte(texte, normalizeName(personne.firstName)) ? personne.firstName : '';
  const last = motDansTexte(texte, normalizeName(personne.lastName)) ? personne.lastName : '';
  if (!first && !last) return null;
  return { ...personne, firstName: first, lastName: last };
}

function phoneInTranscript(transcript: string, phone: string | null): boolean {
  if (!phone) return false;
  const digits = normalizePhone(phone);
  if (digits.length < 10) return false;
  const hay = transcript.replace(/\D/g, '');
  return hay.includes(digits) || hay.includes(digits.slice(1));
}

/** Numéros FR même dictés avec des points ou des virgules (« 06 87 71. 28, 42 »). */
const TEL_FR = /(?:\+33|0033|0)\s*[1-9](?:[\s.\-/,]*\d){8}/g;

export function extraireTelephones(transcript: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of transcript.matchAll(TEL_FR)) {
    const n = normalizePhone(match[0]);
    if (n.length !== 10 || !n.startsWith('0') || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function rattacherTelephonePersonne<T extends { phone: string | null }>(
  personne: T,
  telephones: string[],
): T {
  if (personne.phone?.trim()) {
    const n = normalizePhone(personne.phone);
    const i = n.length >= 10 ? telephones.indexOf(n) : -1;
    if (i >= 0) telephones.splice(i, 1);
    return personne;
  }
  const next = telephones.shift();
  if (!next) return personne;
  return { ...personne, phone: next };
}

/**
 * Contacts dont le nom complet (prénom + nom) ou le téléphone est dans la dictée.
 * On ne mélange pas les tokens de deux personnes (« Amélie Jacquet » + « Perrin »
 * ne doit pas faire remonter « Amélie Perrot »).
 */
export function matchContactsInTranscript(
  transcript: string,
  contacts: readonly MatchableContact[],
  agencyId: string,
): ContactMatch[] {
  const text = transcript.trim();
  if (!text) return [];

  const hits: ContactMatch[] = [];
  const seen = new Set<string>();

  for (const contact of contacts) {
    if (contact.agencyId !== agencyId) continue;
    if (!phoneInTranscript(text, contact.phone)) continue;
    seen.add(contact.id);
    hits.push({
      contactId: contact.id,
      label: contact.fullName,
      confiance: 'certain',
      raison: 'telephone',
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
    });
  }

  const texte = ` ${normalizeName(text)} `;
  for (const contact of contacts) {
    if (contact.agencyId !== agencyId || seen.has(contact.id)) continue;
    const first = normalizeName(contact.firstName);
    const last = normalizeName(contact.lastName);
    if (!first || !last) continue;
    if (!motDansTexte(texte, first) || !motDansTexte(texte, last)) continue;
    seen.add(contact.id);
    hits.push({
      contactId: contact.id,
      label: contact.fullName,
      confiance: 'certain',
      raison: 'nom',
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
    });
  }

  for (const guessed of guessPersonnesFromTranscript(text)) {
    for (const match of matchContacts(guessed, contacts, agencyId)) {
      if (seen.has(match.contactId)) continue;
      seen.add(match.contactId);
      hits.push(match);
    }
  }

  return hits;
}

export type MemberMatch = {
  memberId: string;
  label: string;
};

/**
 * Conseiller de l’agence nommé dans la dictée (« par Thomas Perrin »).
 */
export function matchMembersInTranscript(
  transcript: string,
  members: readonly { id: string; fullName: string }[],
): MemberMatch[] {
  const pairs = guessPersonnesFromTranscript(transcript);
  if (pairs.length === 0) return [];

  const out: MemberMatch[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    const tokens = nameTokens(member.fullName);
    if (tokens.length < 2) continue;
    const hit = pairs.some((p) => {
      const nom = scoreNom(member.fullName, `${p.firstName} ${p.lastName}`);
      return nom.complet && nom.tokensTrouves >= 2 && !nom.approximatif;
    });
    if (!hit || seen.has(member.id)) continue;
    seen.add(member.id);
    out.push({ memberId: member.id, label: member.fullName });
  }
  return out;
}

export function personneFromMatch(
  match: ContactMatch,
  contacts: readonly MatchableContact[],
): ExtractedPersonne {
  const contact = contacts.find((c) => c.id === match.contactId);
  return {
    firstName: contact?.firstName ?? '',
    lastName: contact?.lastName ?? match.label,
    phone: contact?.phone ?? null,
    email: contact?.email ?? null,
    type: 'autre',
  };
}

