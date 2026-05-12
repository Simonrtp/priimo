export type LeadSegmentTab = 'tous' | 'entreprises' | 'particuliers';

/** Propriétaire du bien (aligné sur le segment UI). */
export type LeadOwner = 'enterprise' | 'individual';

export type LeadZoneId = 'paris-13' | 'paris-14' | 'paris-15';

export type LeadStatus =
  | 'nouveau'
  | 'contacté'
  | 'intéressé'
  | 'pas_intéressé'
  | 'rdv_pris';

/** Personne morale (SCI / SARL) — distinct du segment « entreprise » côté produit. */
export type LegalForm = 'sci' | 'sarl';

export type LeadSegment = 'entreprise' | 'particulier';

/** Issue finale du prospect (alimente le ML futur). */
export type ProspectOutcome =
  | 'none'
  | 'mandat_signe'
  | 'vendu_ailleurs'
  | 'pas_vendeur'
  | 'pas_contacte';

export interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  /** Nom complet affiché (listes, selects). */
  name: string;
}

/** Signaux détectés sur un lead (union stricte). */
export type SignalType =
  | 'dissolution_sci'
  | 'liquidation'
  | 'cession_parts'
  | 'changement_gerant'
  | 'deces_associe'
  | 'dpe_recent'
  | 'dpe_passoire'
  | 'detention_longue'
  | 'plus_value'
  | 'travaux_recents'
  | 'zone_rotation';

/** Événement de vie / société affiché en badge (sous-ensemble des signaux BODACC côté PM). */
export type LifeEvent =
  | 'dissolution_sci'
  | 'liquidation'
  | 'cession_parts'
  | 'changement_gerant'
  | 'deces_associe'
  | null;

/** Signaux BODACC / société — jamais sur des leads « particulier ». */
export const EVENEMENT_SOCIETE_SIGNALS: readonly SignalType[] = [
  'dissolution_sci',
  'liquidation',
  'cession_parts',
  'changement_gerant',
  'deces_associe',
] as const;

/** Valeur du filtre « Signaux » (inclut le regroupement vue « Tous »). */
export type SignalFilterValue = 'all' | SignalType | 'evenement_societe';

export interface LeadSignals {
  years_owned: number;
  days_since_dpe: number;
  estimated_gain_pct: number;
  life_event: LifeEvent;
  zone_rotation_rate: number;
}

export interface Lead {
  id: string;
  address: string;
  lat: number;
  lng: number;
  score: number;
  signalType: SignalType[];
  signals: LeadSignals;
  propertyType: string;
  surface: number;
  purchaseDate: string;
  purchasePrice: number;
  estimatedValue: number;
  lifeEvent: LifeEvent;
  status: LeadStatus;
  segment: LeadSegment;
  /** Redondant avec `segment` pour clarté / exports `Owner`. */
  owner: LeadOwner;
  legalForm: LegalForm | null;
  assignedAgentId: string | null;
  prospectOutcome: ProspectOutcome;
  notes: string;
  createdAt: string;
  zoneId: LeadZoneId;
  /** Ligne compacte sous l’adresse (SCI/SARL uniquement). */
  companyOwnerLine: string | null;
  companyName: string | null;
  rcs: string | null;
  directorName: string | null;
  directorPhonePro: string | null;
  directorEmailPro: string | null;
  /** Téléphone pro disponible côté données (affiché si plan Premium). */
  directorPhoneProAvailable: boolean;
  /** Sources alignées sur `signalType` (même ordre, même longueur). */
  signalSources: string[];
}

export function leadHasEvenementSociete(lead: Pick<Lead, 'signalType'>): boolean {
  return lead.signalType.some((s) =>
    (EVENEMENT_SOCIETE_SIGNALS as readonly string[]).includes(s),
  );
}

export interface Filters {
  minScore: number;
  signalType: SignalFilterValue;
  status: 'all' | LeadStatus;
  /** Filtre agent : tous, non assigné, ou id agent. */
  assignedTo: 'all' | 'unassigned' | string;
  zoneId: 'all' | LeadZoneId;
}
