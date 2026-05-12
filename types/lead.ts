export type LeadSegmentTab = 'tous' | 'entreprises' | 'particuliers';

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
  name: string;
}

export type SignalType =
  | 'liquidation_pro'
  | 'dissolution_sci'
  | 'cession_entreprise'
  | 'dpe_recent'
  | 'detention_longue'
  | 'plus_value'
  | 'zone_rotation';

export type LifeEvent =
  | 'liquidation_pro'
  | 'dissolution_sci'
  | 'cession_entreprise'
  | null;

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
  legalForm: LegalForm | null;
  assignedAgentId: string | null;
  prospectOutcome: ProspectOutcome;
  notes: string;
  createdAt: string;
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

export interface Filters {
  minScore: number;
  signalType: 'all' | SignalType;
  status: 'all' | LeadStatus;
}
