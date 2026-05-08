export type LeadStatus = 'nouveau' | 'contacté' | 'intéressé' | 'pas_intéressé';

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
  notes: string;
  createdAt: string;
}

export interface Filters {
  minScore: number;
  signalType: 'all' | SignalType;
  status: 'all' | LeadStatus;
}
