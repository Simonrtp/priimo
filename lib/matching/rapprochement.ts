/**
 * Rapprochement acquéreur / bien.
 *
 * Module volontairement isolé et sans dépendance React ni Supabase : il prend
 * un bien et une liste de contacts, il rend une liste de correspondances.
 * Toute la logique métier tient ici pour rester testable et ajustable sans
 * toucher à l'interface.
 */

import type { Contact } from '@/types/contact';

/* -------------------------------------------------------------------------- */
/* Configuration — les seuls réglages à toucher                               */
/* -------------------------------------------------------------------------- */

export interface RapprochementConfig {
  /** Le prix peut dépasser le budget maximum de cette proportion (0.1 = 10 %). */
  toleranceBudget: number;
  /** La surface peut être inférieure au minimum demandé de cette proportion. */
  toleranceSurface: number;
  /** Nombre de pièces acceptées en dessous du minimum demandé. */
  tolerancePieces: number;
  /** En dessous de ce score sur 100, la correspondance n'est pas proposée. */
  scoreMinimum: number;
  /** Nombre maximum d'acquéreurs proposés pour un même bien. */
  maxAcquereursParBien: number;
  /** Un contact sans aucun critère n'est jamais proposé (sinon tout matche). */
  exigerAuMoinsUnCritere: boolean;
}

export const RAPPROCHEMENT_CONFIG: RapprochementConfig = {
  toleranceBudget: 0.1,
  toleranceSurface: 0.1,
  tolerancePieces: 1,
  scoreMinimum: 55,
  maxAcquereursParBien: 5,
  exigerAuMoinsUnCritere: true,
};

/* -------------------------------------------------------------------------- */
/* Entrées / sorties                                                          */
/* -------------------------------------------------------------------------- */

/** Le strict nécessaire pour rapprocher : accepte un bien comme un lead travaillé. */
export interface RapprochableBien {
  id: string;
  address: string;
  postalCode: string | null;
  price: number | null;
  surfaceM2: number | null;
  rooms: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface MatchAcquereur {
  contact: Contact;
  /** 0 à 100. */
  score: number;
  /** Formulées pour être lues telles quelles par l'agent. */
  raisons: string[];
}

/* -------------------------------------------------------------------------- */
/* Évaluation d'un critère                                                    */
/* -------------------------------------------------------------------------- */

type CritereResult =
  | { evalue: false }
  | { evalue: true; rejete: true; raison: string }
  | { evalue: true; rejete: false; points: number; raison: string };

function evaluerSecteur(bien: RapprochableBien, contact: Contact, _c: RapprochementConfig): CritereResult {
  const codes = contact.criteria.postalCodes;
  if (codes.length === 0 || !bien.postalCode) return { evalue: false };
  if (!codes.includes(bien.postalCode)) {
    return { evalue: true, rejete: true, raison: 'hors du secteur recherché' };
  }
  return { evalue: true, rejete: false, points: 100, raison: `secteur ${bien.postalCode}` };
}

function evaluerBudget(bien: RapprochableBien, contact: Contact, c: RapprochementConfig): CritereResult {
  const { budgetMin, budgetMax } = contact.criteria;
  const prix = bien.price;
  if (prix === null || (budgetMin === null && budgetMax === null)) return { evalue: false };

  if (budgetMax !== null && prix > budgetMax) {
    const plafond = budgetMax * (1 + c.toleranceBudget);
    if (prix > plafond) {
      return { evalue: true, rejete: true, raison: 'au-dessus du budget' };
    }
    return {
      evalue: true,
      rejete: false,
      points: 60,
      raison: `légèrement au-dessus du budget (${formatEuros(budgetMax)} annoncé)`,
    };
  }

  if (budgetMin !== null && prix < budgetMin) {
    // Moins cher que prévu : jamais bloquant, mais peut signaler un bien trop modeste.
    return { evalue: true, rejete: false, points: 80, raison: 'en dessous du budget annoncé' };
  }

  return { evalue: true, rejete: false, points: 100, raison: 'dans le budget' };
}

function evaluerSurface(bien: RapprochableBien, contact: Contact, c: RapprochementConfig): CritereResult {
  const { surfaceMin, surfaceMax } = contact.criteria;
  const surface = bien.surfaceM2;
  if (surface === null || (surfaceMin === null && surfaceMax === null)) return { evalue: false };

  if (surfaceMin !== null && surface < surfaceMin) {
    const plancher = surfaceMin * (1 - c.toleranceSurface);
    if (surface < plancher) {
      return { evalue: true, rejete: true, raison: 'trop petit' };
    }
    return { evalue: true, rejete: false, points: 60, raison: `un peu sous les ${surfaceMin} m² demandés` };
  }

  if (surfaceMax !== null && surface > surfaceMax) {
    return { evalue: true, rejete: false, points: 75, raison: 'plus grand que demandé' };
  }

  return { evalue: true, rejete: false, points: 100, raison: `${surface} m²` };
}

function evaluerPieces(bien: RapprochableBien, contact: Contact, c: RapprochementConfig): CritereResult {
  const { roomsMin } = contact.criteria;
  if (bien.rooms === null || roomsMin === null) return { evalue: false };

  if (bien.rooms < roomsMin) {
    if (bien.rooms < roomsMin - c.tolerancePieces) {
      return { evalue: true, rejete: true, raison: 'pas assez de pièces' };
    }
    return { evalue: true, rejete: false, points: 60, raison: `${bien.rooms} pièces au lieu de ${roomsMin}` };
  }

  return { evalue: true, rejete: false, points: 100, raison: `${bien.rooms} pièces` };
}

const CRITERES = [
  { evaluer: evaluerSecteur, poids: 3 },
  { evaluer: evaluerBudget, poids: 3 },
  { evaluer: evaluerSurface, poids: 2 },
  { evaluer: evaluerPieces, poids: 1 },
] as const;

/* -------------------------------------------------------------------------- */
/* API du module                                                              */
/* -------------------------------------------------------------------------- */

/** Évalue un contact face à un bien. Rend null si la correspondance est exclue. */
export function evaluerCorrespondance(
  bien: RapprochableBien,
  contact: Contact,
  config: RapprochementConfig = RAPPROCHEMENT_CONFIG,
): MatchAcquereur | null {
  if (contact.type !== 'acquereur') return null;

  let total = 0;
  let poidsTotal = 0;
  const raisons: string[] = [];

  for (const { evaluer, poids } of CRITERES) {
    const res = evaluer(bien, contact, config);
    if (!res.evalue) continue;
    if (res.rejete) return null;
    total += res.points * poids;
    poidsTotal += poids;
    raisons.push(res.raison);
  }

  if (poidsTotal === 0) {
    return config.exigerAuMoinsUnCritere ? null : { contact, score: 0, raisons: [] };
  }

  const score = Math.round(total / poidsTotal);
  if (score < config.scoreMinimum) return null;

  return { contact, score, raisons };
}

/** Les acquéreurs qui correspondent à un bien, du meilleur au moins bon. */
export function rapprocherAcquereurs(
  bien: RapprochableBien,
  contacts: readonly Contact[],
  config: RapprochementConfig = RAPPROCHEMENT_CONFIG,
): MatchAcquereur[] {
  const matches: MatchAcquereur[] = [];

  for (const contact of contacts) {
    const match = evaluerCorrespondance(bien, contact, config);
    if (match) matches.push(match);
  }

  matches.sort((a, b) => b.score - a.score || a.contact.fullName.localeCompare(b.contact.fullName, 'fr'));
  return matches.slice(0, config.maxAcquereursParBien);
}

/** Tous les biens qui ont au moins une correspondance, biens vides écartés. */
export function rapprocherTousLesBiens(
  biens: readonly RapprochableBien[],
  contacts: readonly Contact[],
  config: RapprochementConfig = RAPPROCHEMENT_CONFIG,
): Array<{ bien: RapprochableBien; matches: MatchAcquereur[] }> {
  return biens
    .map((bien) => ({ bien, matches: rapprocherAcquereurs(bien, contacts, config) }))
    .filter((r) => r.matches.length > 0);
}

function formatEuros(v: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(v)} €`;
}
