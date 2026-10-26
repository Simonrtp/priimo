import { parseContactInput, type ContactInputFields } from '@/lib/contact-input';
import type { Contact, ContactType } from '@/types/contact';
import { repartirRoles, rolesDuContact } from '@/types/contact';
import type { ImportField } from './mapping';
import {
  formatPhoneDisplay,
  nettoyerEmail,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  reparerTelephones,
} from './normalize';

/** Alias rangés par préférence. En-têtes Google Contacts, Outlook (FR/EN) et vCard compris. */
export const CONTACT_IMPORT_FIELDS: readonly ImportField[] = [
  { key: 'firstName', label: 'Prénom', aliases: ['prenom', 'prenoms', 'firstname', 'givenname', 'first'] },
  {
    key: 'lastName',
    label: 'Nom',
    aliases: ['nom', 'lastname', 'familyname', 'surname', 'nomdefamille', 'last'],
  },
  {
    key: 'fullName',
    label: 'Nom complet',
    aliases: [
      'nomcomplet',
      'fullname',
      'nomprenom',
      'nometprenom',
      'prenomnom',
      'name',
      'displayname',
      'nomaffiche',
      'client',
      'contact',
      'raisonsociale',
    ],
  },
  {
    key: 'phone',
    label: 'Téléphone',
    aliases: [
      'portable',
      'mobile',
      'telportable',
      'telephoneportable',
      'telmobile',
      'telephonemobile',
      'mobilephone',
      'gsm',
      'tel',
      'telephone',
      'phone',
      'numerotel',
      'numerodetelephone',
      'phone1value',
      'primaryphone',
      'homephone',
      'telephonedomicile',
      'businessphone',
      'telephonebureau',
      'telephoneprofessionnel',
    ],
  },
  {
    key: 'phone2',
    label: 'Autre téléphone',
    aliases: [
      'autretelephone',
      'autretel',
      'telephone2',
      'tel2',
      'fixe',
      'telfixe',
      'telephonefixe',
      'phone2value',
      'otherphone',
      'homephone',
      'telephonedomicile',
      'businessphone',
      'telephonebureau',
      'telephoneprofessionnel',
    ],
  },
  {
    key: 'email',
    label: 'Email',
    aliases: [
      'email',
      'mail',
      'courriel',
      'adresseemail',
      'adressemail',
      'email1value',
      'emailaddress',
      'adressedemessagerie',
    ],
  },
  {
    key: 'type',
    label: 'Type',
    aliases: ['type', 'typedecontact', 'typecontact', 'qualite', 'categorie', 'role', 'profil'],
  },
  {
    key: 'secteur',
    label: 'Secteur',
    aliases: ['secteur', 'quartier', 'zone', 'secteurgeo'],
  },
  {
    key: 'address',
    label: 'Adresse',
    aliases: [
      'adresse',
      'address',
      'rue',
      'voie',
      'adressepostale',
      'adressecomplete',
      'address1street',
      'homestreet',
      'ruedomicile',
      'address1formatted',
      'businessstreet',
      'ruebureau',
    ],
  },
  {
    key: 'ville',
    label: 'Ville',
    aliases: ['ville', 'city', 'commune', 'localite', 'address1city', 'homecity', 'villedomicile', 'businesscity'],
  },
  {
    key: 'postalCodes',
    label: 'Codes postaux',
    aliases: [
      'codepostal',
      'cp',
      'codespostaux',
      'postal',
      'postalcode',
      'zip',
      'zipcode',
      'address1postalcode',
      'homepostalcode',
      'codepostaldomicile',
      'businesspostalcode',
    ],
  },
  {
    key: 'budgetMin',
    label: 'Budget min',
    aliases: ['budgetmin', 'budgetminimum', 'prixmin'],
  },
  {
    key: 'budgetMax',
    label: 'Budget max',
    aliases: ['budgetmax', 'budgetmaximum', 'budget', 'prixmax'],
  },
  {
    key: 'surfaceMin',
    label: 'Surface min',
    aliases: ['surfacemin', 'surface', 'm2', 'superficie'],
  },
  {
    key: 'roomsMin',
    label: 'Pièces min',
    aliases: ['piecesmin', 'pieces', 'nbpieces', 'nbrepieces'],
  },
  {
    key: 'summary',
    label: 'Résumé',
    aliases: [
      'resume',
      'notes',
      'note',
      'commentaire',
      'commentaires',
      'remarque',
      'remarques',
      'observations',
      'observation',
      'description',
    ],
  },
];

/**
 * Colonnes sans champ Priimo mais utiles (historique, source, négociateur…) :
 * elles s'ajoutent au résumé, « En-tête : valeur », plutôt que de se perdre.
 */
export function avecNotesEnPlus(
  mapped: Record<string, string>,
  values: Record<string, string>,
  notes: readonly string[],
): Record<string, string> {
  const lignes = notes
    .map((header) => {
      const v = values[header]?.trim();
      return v ? `${header} : ${v}` : '';
    })
    .filter(Boolean);
  if (lignes.length === 0) return mapped;
  return { ...mapped, summary: [mapped.summary ?? '', ...lignes].filter(Boolean).join('\n') };
}

/** Au moins une de ces colonnes doit être reliée pour qu'une fiche ait un sens. */
export const CONTACT_IMPORT_IDENTITE = ['firstName', 'lastName', 'fullName', 'phone', 'email'] as const;

export function contactMappingSuffisant(mapping: Record<string, string>): boolean {
  return CONTACT_IMPORT_IDENTITE.some((key) => Boolean(mapping[key]));
}

export interface ContactDuplicateRef {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
}

const ROLES_LUS: readonly [RegExp, ContactType][] = [
  [/(vendeur|vendeuse|proprietaire|seller|\bvente\b|\bvendre\b)/, 'vendeur'],
  [/(acquereur|acheteur|acheteuse|investisseur|buyer|\bachat\b|\bacheter\b)/, 'acquereur'],
  [/(locataire|tenant)/, 'locataire'],
  [/(gardien|concierge)/, 'gardien'],
  [/(commercant|commerce)/, 'commercant'],
];

function sansAccents(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('fr')
    .trim();
}

/** Tous les rôles qu'une case « Type » laisse lire : « Vendeur / Acquéreur » en donne deux. */
export function interpretContactRoles(raw: string): ContactType[] {
  const s = sansAccents(raw);
  const roles = ROLES_LUS.filter(([motif]) => motif.test(s)).map(([, role]) => role);
  return roles.length ? roles : ['autre'];
}

export function interpretContactType(raw: string): ContactType {
  return interpretContactRoles(raw)[0] ?? 'autre';
}

const CIVILITE = /^(m|mr|mme|mlle|mm|monsieur|madame|mademoiselle|messieurs|dr|me|et|&)\.?$/i;

function retirerCivilites(parts: string[]): string[] {
  let debut = 0;
  while (debut < parts.length - 1 && CIVILITE.test(parts[debut] ?? '')) debut++;
  return parts.slice(debut);
}

/** « DUPONT » : au moins deux lettres, toutes en capitales. */
function enCapitales(mot: string): boolean {
  const lettres = mot.replace(/[^\p{L}]/gu, '');
  return lettres.length >= 2 && lettres === lettres.toLocaleUpperCase('fr') && lettres !== lettres.toLocaleLowerCase('fr');
}

/**
 * « Marie Curie », « CURIE Marie », « Curie, Marie », « M. et Mme DUPONT ».
 * Le mot en capitales est le nom de famille, où qu'il soit.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const texte = fullName.trim();
  if (texte.includes(',')) {
    const [nom = '', ...reste] = texte.split(',');
    const prenom = reste.join(' ').trim();
    if (nom.trim() && prenom) return { firstName: prenom, lastName: nom.trim() };
  }
  const parts = retirerCivilites(texte.split(/\s+/).filter(Boolean));
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0] ?? '' };
  const capitales = parts.filter(enCapitales);
  if (capitales.length > 0 && capitales.length < parts.length) {
    return {
      firstName: parts.filter((p) => !enCapitales(p)).join(' '),
      lastName: capitales.join(' '),
    };
  }
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1] ?? '',
  };
}

/**
 * Un montant tel qu'on l'écrit : « 250 000 € », « 250.000 », « 250k », « 1,2 M€ »,
 * « 65 m² », « T3 ». Rend le premier nombre lu, ou null.
 */
export function lireNombre(raw: string | null | undefined): number | null {
  const s = (raw ?? '').replace(/m\s*[2²]/gi, ' ').replace(/[  ]/g, ' ').trim();
  const m = s.match(/\d[\d\s.,]*/);
  if (!m) return null;
  let t = m[0].trim();
  t = /^\d{1,3}([.\s]\d{3})+(,\d+)?$/.test(t) ? t.replace(/[.\s]/g, '') : t.replace(/\s/g, '');
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const suite = s.slice((m.index ?? 0) + m[0].length).trim();
  if (/^k/i.test(suite)) return Math.round(n * 1_000);
  if (/^m(€|e\b|$|\s)/i.test(suite)) return Math.round(n * 1_000_000);
  return n;
}

/** « 300 000 - 400 000 » ou « 300k à 400k » : les deux bornes ; sinon une seule. */
function lireFourchette(raw: string | null | undefined): [number | null, number | null] {
  const parts = (raw ?? '').split(/\s*[-–]\s*|\s+à\s+/).filter((p) => /\d/.test(p));
  if (parts.length === 2) {
    const a = lireNombre(parts[0]);
    const b = lireNombre(parts[1]);
    if (a !== null && b !== null) return a <= b ? [a, b] : [b, a];
  }
  return [null, lireNombre(raw)];
}

/** Codes postaux, y compris ceux dont Excel a mangé le zéro (1000 → 01000). */
function lireCodesPostaux(raw: string | null | undefined): string {
  return (raw ?? '')
    .split(/[,;\s/]+/)
    .map((t) => (/^\d{4}$/.test(t) ? `0${t}` : t))
    .join(',');
}

function afficherNumero(numero: string): string {
  return /^0\d{9}$/.test(normalizePhone(numero)) ? formatPhoneDisplay(numero) : numero;
}

export type ContactImportLu =
  | { fields: ContactInputFields; avertissements: string[] }
  | { error: string };

/**
 * Une ligne de fichier → une fiche. Rien n'écarte une ligne pour un détail :
 * un email illisible est laissé de côté (et signalé), une fiche sans nom prend
 * son numéro. Seule une ligne sans nom, sans téléphone et sans email est écartée.
 */
export function contactFieldsFromMapped(mapped: Record<string, string>): ContactImportLu {
  const avertissements: string[] = [];

  let firstName = (mapped.firstName ?? '').trim();
  let lastName = (mapped.lastName ?? '').trim();
  if (!firstName && !lastName && mapped.fullName?.trim()) {
    ({ firstName, lastName } = splitFullName(mapped.fullName));
  } else if (!firstName && /\s/.test(lastName)) {
    // Une seule colonne « Nom » qui contient « DUPONT Jean ».
    const split = splitFullName(lastName);
    if (split.firstName && enCapitales(split.lastName)) ({ firstName, lastName } = split);
  }

  const telephones: string[] = [];
  for (const numero of [...reparerTelephones(mapped.phone), ...reparerTelephones(mapped.phone2)]) {
    if (!telephones.some((t) => normalizePhone(t) === normalizePhone(numero))) telephones.push(numero);
  }
  const phoneBrut = (mapped.phone ?? '').trim();
  if (phoneBrut && reparerTelephones(phoneBrut).length === 0) {
    avertissements.push(`téléphone illisible (« ${phoneBrut.slice(0, 40)} ») laissé de côté`);
  }
  const phone = telephones[0] ?? null;

  const emailBrut = (mapped.email ?? '').trim();
  const email = nettoyerEmail(emailBrut);
  if (emailBrut && !email) {
    avertissements.push(`email illisible (« ${emailBrut.slice(0, 60)} ») laissé de côté`);
  }

  if (!firstName && !lastName) {
    if (phone) {
      lastName = afficherNumero(phone);
      avertissements.push('sans nom : enregistré sous son numéro');
    } else if (email) {
      lastName = email;
      avertissements.push('sans nom : enregistré sous son email');
    } else {
      return { error: 'Ni nom, ni téléphone, ni email' };
    }
  }

  let address = (mapped.address ?? '').replace(/\s*\n+\s*/g, ', ').trim();
  let secteur = (mapped.secteur ?? '').trim();
  let ville = (mapped.ville ?? '').trim();
  let codesPostaux = mapped.postalCodes ?? '';
  // « 75002 Paris » dans une seule colonne : le code postal ne se perd pas.
  const cpDansVille = ville.match(/\b\d{5}\b/);
  if (cpDansVille && !codesPostaux.trim()) {
    codesPostaux = cpDansVille[0];
    if (!address) ville = ville.replace(cpDansVille[0], '').replace(/\s{2,}/g, ' ').trim();
  }
  if (ville) {
    if (address && !normalizeName(address).includes(normalizeName(ville))) address = `${address}, ${ville}`;
    else if (!address && !secteur) secteur = ville;
  }

  let [budgetMin, budgetMax] = lireFourchette(mapped.budgetMax);
  if (mapped.budgetMin?.trim()) budgetMin = lireNombre(mapped.budgetMin);
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
    [budgetMin, budgetMax] = [budgetMax, budgetMin];
  }

  const summary = [
    (mapped.summary ?? '').trim(),
    telephones.length > 1 ? `Autres numéros : ${telephones.slice(1).map(afficherNumero).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const roles = interpretContactRoles(mapped.type ?? '');
  const parsed = parseContactInput({
    firstName,
    lastName,
    type: roles[0],
    autresTypes: roles.slice(1),
    phone,
    email,
    secteur: secteur || null,
    address: address || null,
    postalCodes: lireCodesPostaux(codesPostaux),
    budgetMin,
    budgetMax,
    surfaceMin: lireNombre(mapped.surfaceMin),
    roomsMin: lireNombre(mapped.roomsMin),
    summary: summary || null,
  });

  return parsed.ok ? { fields: parsed.fields, avertissements } : { error: parsed.error };
}

export function nameKey(firstName: string, lastName: string): string {
  return normalizeName(`${firstName} ${lastName}`);
}

export function findContactDuplicate(
  fields: ContactInputFields,
  existing: readonly ContactDuplicateRef[],
): ContactDuplicateRef | null {
  const phone = fields.phone ? normalizePhone(fields.phone) : '';
  if (phone.length >= 8) {
    const byPhone = existing.find((c) => c.phone && normalizePhone(c.phone) === phone);
    if (byPhone) return byPhone;
  }

  const email = fields.email ? normalizeEmail(fields.email) : '';
  const name = nameKey(fields.firstName, fields.lastName);
  if (email && name) {
    const byNameEmail = existing.find(
      (c) =>
        c.email &&
        normalizeEmail(c.email) === email &&
        nameKey(c.firstName, c.lastName) === name,
    );
    if (byNameEmail) return byNameEmail;
  }

  return null;
}

export function contactToDuplicateRef(contact: Contact): ContactDuplicateRef {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phone,
    email: contact.email,
  };
}

export function contactToInput(contact: Contact): ContactInputFields {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    type: contact.type,
    autresTypes: contact.autresTypes ?? [],
    phone: contact.phone,
    numeroCommuniqueParLaPersonne: contact.numeroCommuniqueParLaPersonne === true,
    email: contact.email,
    secteur: contact.secteur,
    address: contact.address,
    postalCodes: contact.criteria.postalCodes,
    budgetMin: contact.criteria.budgetMin,
    budgetMax: contact.criteria.budgetMax,
    surfaceMin: contact.criteria.surfaceMin,
    surfaceMax: contact.criteria.surfaceMax,
    roomsMin: contact.criteria.roomsMin,
    summary: contact.summary,
    recontacterLe: contact.recontacterLe,
  };
}

const CHAMPS_A_REMPLIR = [
  'firstName',
  'lastName',
  'secteur',
  'address',
  'budgetMin',
  'budgetMax',
  'surfaceMin',
  'surfaceMax',
  'roomsMin',
] as const satisfies readonly (keyof ContactInputFields)[];

function estVide(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && !v.trim());
}

/**
 * Fusion douce : la fiche existante gagne toujours. On remplit ce qui est vide,
 * on ajoute les rôles, et un numéro ou un email différent va dans le résumé
 * plutôt que d'écraser celui de la fiche. Rend les champs effectivement changés.
 */
export function completerContact(
  existant: ContactInputFields,
  arrivee: ContactInputFields,
): { fields: ContactInputFields; champs: (keyof ContactInputFields)[] } {
  const next: ContactInputFields = {
    ...existant,
    postalCodes: [...existant.postalCodes],
    autresTypes: [...existant.autresTypes],
  };
  const champs = new Set<keyof ContactInputFields>();
  const ecrire = next as unknown as Record<string, unknown>;

  for (const key of CHAMPS_A_REMPLIR) {
    if (estVide(next[key]) && !estVide(arrivee[key])) {
      ecrire[key] = arrivee[key];
      champs.add(key);
    }
  }

  const avant = rolesDuContact(existant);
  const roles = repartirRoles([...avant, ...rolesDuContact(arrivee)]);
  if (rolesDuContact(roles).join() !== avant.join()) {
    next.type = roles.type;
    next.autresTypes = roles.autresTypes;
    champs.add('type');
  }

  const notes: string[] = [];
  if (arrivee.phone) {
    if (!next.phone) {
      next.phone = arrivee.phone;
      champs.add('phone');
    } else if (normalizePhone(next.phone) !== normalizePhone(arrivee.phone)) {
      notes.push(`Autre numéro : ${afficherNumero(arrivee.phone)}`);
    }
  }
  if (arrivee.email) {
    if (!next.email) {
      next.email = arrivee.email;
      champs.add('email');
    } else if (normalizeEmail(next.email) !== normalizeEmail(arrivee.email)) {
      notes.push(`Autre email : ${arrivee.email}`);
    }
  }

  const codes = [...new Set([...next.postalCodes, ...arrivee.postalCodes])].slice(0, 20);
  if (codes.length !== next.postalCodes.length) {
    next.postalCodes = codes;
    champs.add('postalCodes');
  }

  const dejaEcrit = next.summary ?? '';
  const ajouts = [arrivee.summary ?? '', ...notes]
    .map((t) => t.trim())
    .filter((t) => t && !dejaEcrit.includes(t));
  if (ajouts.length) {
    next.summary = [dejaEcrit.trim(), ...ajouts].filter(Boolean).join('\n').slice(0, 4000);
    champs.add('summary');
  }

  return { fields: next, champs: [...champs] };
}

export type ContactPlanifie =
  | { action: 'create'; line: number; fields: ContactInputFields; avertissements: string[] }
  | {
      action: 'complete';
      line: number;
      fields: ContactInputFields;
      duplicate: ContactDuplicateRef;
      avertissements: string[];
    }
  /** Même personne qu'une ligne précédente du fichier : réunie avec elle. */
  | { action: 'merged'; line: number; avecLigne: number; avertissements: string[] }
  | { action: 'skip'; line: number; reason: string };

/**
 * Le plan d'un import, sans aucune question : une fiche nouvelle est créée,
 * une fiche déjà connue est complétée sans rien écraser, deux lignes de la même
 * personne sont réunies.
 */
/**
 * Mêmes règles que `findContactDuplicate`, en index : 10 000 lignes face à
 * 10 000 fiches restent instantanées.
 */
function indexDoublons(existing: readonly ContactDuplicateRef[]) {
  const parTelephone = new Map<string, ContactDuplicateRef>();
  const parNomEmail = new Map<string, ContactDuplicateRef>();
  const parId = new Map<string, ContactDuplicateRef>();

  const ajouter = (ref: ContactDuplicateRef) => {
    parId.set(ref.id, ref);
    const phone = ref.phone ? normalizePhone(ref.phone) : '';
    if (phone.length >= 8 && !parTelephone.has(phone)) parTelephone.set(phone, ref);
    const email = ref.email ? normalizeEmail(ref.email) : '';
    const name = nameKey(ref.firstName, ref.lastName);
    const cle = `${email}|${name}`;
    if (email && name && !parNomEmail.has(cle)) parNomEmail.set(cle, ref);
  };
  existing.forEach(ajouter);

  return {
    ajouter,
    trouver(fields: ContactInputFields): ContactDuplicateRef | null {
      const phone = fields.phone ? normalizePhone(fields.phone) : '';
      const parTel = phone.length >= 8 ? parTelephone.get(phone) : undefined;
      if (parTel) return parTel;
      const email = fields.email ? normalizeEmail(fields.email) : '';
      const name = nameKey(fields.firstName, fields.lastName);
      return (email && name && parNomEmail.get(`${email}|${name}`)) || null;
    },
    /** Une fiche complétée se retrouve aussi par le numéro ou l'email qu'on vient de lui donner. */
    enrichir(id: string, fields: ContactInputFields) {
      const ref = parId.get(id);
      if (!ref) return;
      ajouter({
        ...ref,
        firstName: ref.firstName || fields.firstName,
        lastName: ref.lastName || fields.lastName,
        phone: ref.phone || fields.phone,
        email: ref.email || fields.email,
      });
    },
  };
}

export function planContactImport(
  rows: readonly { line: number; mapped: Record<string, string> }[],
  existing: readonly ContactDuplicateRef[],
): ContactPlanifie[] {
  const index = indexDoublons(existing);
  const cibles = new Map<string, number>();
  const plan: ContactPlanifie[] = [];

  for (const row of rows) {
    const lu = contactFieldsFromMapped(row.mapped);
    if ('error' in lu) {
      plan.push({ action: 'skip', line: row.line, reason: lu.error });
      continue;
    }

    const duplicate = index.trouver(lu.fields);
    if (duplicate) {
      const position = cibles.get(duplicate.id);
      const cible = position === undefined ? undefined : plan[position];
      if (position !== undefined && cible && (cible.action === 'create' || cible.action === 'complete')) {
        const { fields } = completerContact(cible.fields, lu.fields);
        plan[position] = { ...cible, fields };
        index.enrichir(duplicate.id, fields);
        plan.push({ action: 'merged', line: row.line, avecLigne: cible.line, avertissements: lu.avertissements });
        continue;
      }
      cibles.set(duplicate.id, plan.length);
      plan.push({
        action: 'complete',
        line: row.line,
        fields: lu.fields,
        duplicate,
        avertissements: lu.avertissements,
      });
      index.enrichir(duplicate.id, lu.fields);
      continue;
    }

    const tempId = `pending:${row.line}`;
    cibles.set(tempId, plan.length);
    index.ajouter({
      id: tempId,
      firstName: lu.fields.firstName,
      lastName: lu.fields.lastName,
      phone: lu.fields.phone,
      email: lu.fields.email,
    });
    plan.push({ action: 'create', line: row.line, fields: lu.fields, avertissements: lu.avertissements });
  }

  return plan;
}

export type ResumePlan = { nouveaux: number; connus: number; reunis: number; ecartes: number };

export function resumerPlan(plan: readonly ContactPlanifie[]): ResumePlan {
  const compter = (action: ContactPlanifie['action']) => plan.filter((p) => p.action === action).length;
  return {
    nouveaux: compter('create'),
    connus: compter('complete'),
    reunis: compter('merged'),
    ecartes: compter('skip'),
  };
}
