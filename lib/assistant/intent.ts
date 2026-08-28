/**
 * Intention structurée extraite d'une question. Le modèle ne fait que ça :
 * aucun SQL, aucun fait. Un JSON invalide devient « inconnu ».
 */

import type { ContactTypeDb, MandatStatutDb } from '@/types/database';

export const INTENT_TYPES = [
  'immeuble',
  'personne',
  'recherche_acquereur',
  'activite',
  'produit',
  'inconnu',
] as const;

export type IntentType = (typeof INTENT_TYPES)[number];

export type AssistantFiltres = {
  type_contact: ContactTypeDb | null;
  statut_mandat: MandatStatutDb | null;
};

export type AssistantIntent = {
  type: IntentType;
  adresse: string | null;
  code_postal: string | null;
  nom: string | null;
  periode_jours: number | null;
  filtres: AssistantFiltres;
};

const CONTACT_TYPES: readonly ContactTypeDb[] = [
  'vendeur',
  'acquereur',
  'locataire',
  'gardien',
  'commercant',
  'autre',
];

const MANDAT_STATUTS: readonly MandatStatutDb[] = [
  'estimation',
  'mandat_simple',
  'mandat_exclusif',
  'compromis',
  'vendu',
  'archive',
];

export const EMPTY_INTENT: AssistantIntent = {
  type: 'inconnu',
  adresse: null,
  code_postal: null,
  nom: null,
  periode_jours: null,
  filtres: { type_contact: null, statut_mandat: null },
};

const MAX_STR = 200;
const MAX_PERIODE = 365;

function asString(v: unknown, max = MAX_STR): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === 'null') return null;
  return s.slice(0, max);
}

function asPeriode(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(MAX_PERIODE, Math.round(n));
}

function asType(v: unknown): IntentType {
  return typeof v === 'string' && (INTENT_TYPES as readonly string[]).includes(v)
    ? (v as IntentType)
    : 'inconnu';
}

function asContactType(v: unknown): ContactTypeDb | null {
  const s = asString(v, 40)?.toLocaleLowerCase('fr') ?? null;
  if (!s) return null;
  return (CONTACT_TYPES as readonly string[]).includes(s) ? (s as ContactTypeDb) : null;
}

function asMandat(v: unknown): MandatStatutDb | null {
  const s = asString(v, 40)?.toLocaleLowerCase('fr') ?? null;
  if (!s) return null;
  return (MANDAT_STATUTS as readonly string[]).includes(s) ? (s as MandatStatutDb) : null;
}

/** Retire d'éventuelles fences markdown. Rien d'autre : un JSON encore invalide → inconnu. */
export function stripJsonFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  return s.trim();
}

export function parseIntent(raw: string | null | undefined): AssistantIntent {
  if (!raw || !raw.trim()) return { ...EMPTY_INTENT };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(raw));
  } catch {
    return { ...EMPTY_INTENT };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...EMPTY_INTENT };
  }

  const obj = parsed as Record<string, unknown>;
  const filtresRaw =
    obj.filtres && typeof obj.filtres === 'object' && !Array.isArray(obj.filtres)
      ? (obj.filtres as Record<string, unknown>)
      : {};

  const cp = asString(obj.code_postal, 10);
  const codePostal = cp && /^\d{5}$/.test(cp) ? cp : asString(obj.code_postal, 10);

  return {
    type: asType(obj.type),
    adresse: asString(obj.adresse),
    code_postal: codePostal,
    nom: asString(obj.nom, 120),
    periode_jours: asPeriode(obj.periode_jours),
    filtres: {
      type_contact: asContactType(filtresRaw.type_contact),
      statut_mandat: asMandat(filtresRaw.statut_mandat),
    },
  };
}

export function labelCherche(intent: AssistantIntent): string {
  if (intent.type === 'immeuble') return intent.adresse ?? 'cette adresse';
  if (intent.type === 'personne') return intent.nom ?? 'cette personne';
  if (intent.type === 'recherche_acquereur') {
    return intent.adresse ?? intent.code_postal ?? 'cette recherche';
  }
  if (intent.type === 'activite') {
    const n = intent.periode_jours ?? 7;
    return n === 1 ? "l'activité du jour" : `l'activité des ${n} derniers jours`;
  }
  if (intent.type === 'produit') return 'le fonctionnement de Priimo';
  return 'cette recherche';
}

/** Exemples du contrat d'interprétation — aussi injectés dans le prompt. */
export const INTERPRET_EXAMPLES: ReadonlyArray<{ question: string; intent: AssistantIntent }> = [
  {
    question: "Qu'est-ce qu'on sait du 27 rue Alphonse Penaud ?",
    intent: {
      type: 'immeuble',
      adresse: '27 rue Alphonse Penaud',
      code_postal: null,
      nom: null,
      periode_jours: null,
      filtres: { type_contact: null, statut_mandat: null },
    },
  },
  {
    question: 'Qui est au 12 rue de la Monnaie, 59000 Lille ?',
    intent: {
      type: 'immeuble',
      adresse: '12 rue de la Monnaie',
      code_postal: '59000',
      nom: null,
      periode_jours: null,
      filtres: { type_contact: null, statut_mandat: null },
    },
  },
  {
    question: 'Tu as le dossier Martin ?',
    intent: {
      type: 'personne',
      adresse: null,
      code_postal: null,
      nom: 'Martin',
      periode_jours: null,
      filtres: { type_contact: null, statut_mandat: null },
    },
  },
  {
    question: 'Des nouvelles de Sophie Dubois ?',
    intent: {
      type: 'personne',
      adresse: null,
      code_postal: null,
      nom: 'Sophie Dubois',
      periode_jours: null,
      filtres: { type_contact: null, statut_mandat: null },
    },
  },
  {
    question: 'Qui cherche un appartement dans le 75020 ?',
    intent: {
      type: 'recherche_acquereur',
      adresse: null,
      code_postal: '75020',
      nom: null,
      periode_jours: null,
      filtres: { type_contact: 'acquereur', statut_mandat: null },
    },
  },
  {
    question: 'Quels acquéreurs pour le 15 rue des Pyrénées ?',
    intent: {
      type: 'recherche_acquereur',
      adresse: '15 rue des Pyrénées',
      code_postal: null,
      nom: null,
      periode_jours: null,
      filtres: { type_contact: 'acquereur', statut_mandat: null },
    },
  },
  {
    question: "Qu'est-ce qu'on a fait cette semaine ?",
    intent: {
      type: 'activite',
      adresse: null,
      code_postal: null,
      nom: null,
      periode_jours: 7,
      filtres: { type_contact: null, statut_mandat: null },
    },
  },
  {
    question: "L'activité des 30 derniers jours",
    intent: {
      type: 'activite',
      adresse: null,
      code_postal: null,
      nom: null,
      periode_jours: 30,
      filtres: { type_contact: null, statut_mandat: null },
    },
  },
  {
    question: 'Le mandat du 8 avenue de la République',
    intent: {
      type: 'immeuble',
      adresse: '8 avenue de la République',
      code_postal: null,
      nom: null,
      periode_jours: null,
      filtres: { type_contact: null, statut_mandat: null },
    },
  },
  {
    question: "Qu'est-ce que tu sais de la rue Vitruve ?",
    intent: {
      type: 'immeuble',
      adresse: 'rue Vitruve',
      code_postal: null,
      nom: null,
      periode_jours: null,
      filtres: { type_contact: null, statut_mandat: null },
    },
  },
  {
    question: 'À quoi sert le bouton Nouveau ?',
    intent: {
      type: 'produit',
      adresse: null,
      code_postal: null,
      nom: null,
      periode_jours: null,
      filtres: { type_contact: null, statut_mandat: null },
    },
  },
  {
    question: 'Ça veut dire quoi le score d’un prospect ?',
    intent: {
      type: 'produit',
      adresse: null,
      code_postal: null,
      nom: null,
      periode_jours: null,
      filtres: { type_contact: null, statut_mandat: null },
    },
  },
  {
    question: 'Quel temps fera-t-il demain à Paris ?',
    intent: {
      type: 'inconnu',
      adresse: null,
      code_postal: null,
      nom: null,
      periode_jours: null,
      filtres: { type_contact: null, statut_mandat: null },
    },
  },
];
