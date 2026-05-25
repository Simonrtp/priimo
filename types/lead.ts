import type { LeadMlFeedbackDb, LeadOwnerTypeDb, LeadStatusDb } from '@/types/database';
import type { QuickFilter } from '@/lib/lead-display';

export type LeadSegmentTab = 'tous' | 'entreprises' | 'particuliers';

export type LeadStatus = LeadStatusDb;
export type OwnerType = LeadOwnerTypeDb;
export type MlFeedback = LeadMlFeedbackDb | null;

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

export const COMPANY_EVENT_SIGNALS: readonly SignalType[] = [
  'dissolution_sci',
  'liquidation',
  'cession_parts',
  'changement_gerant',
  'deces_associe',
] as const;

export interface LeadSignal {
  /** Type backend (ex. duree_detention, dpe_classe) ou type legacy Priimo. */
  type: string;
  label: string;
  pts: number;
  source: string;
}

export interface Lead {
  id: string;
  agencyId: string;
  address: string;
  city: string | null;
  postalCode: string | null;
  propertyType: string | null;
  surfaceM2: number | null;
  ownerType: OwnerType;
  companyName: string | null;
  companyDirector: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  score: number;
  signals: LeadSignal[];
  mainSignalLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  acquiredYear: number | null;
  acquiredPrice: number | null;
  estimatedValue: number | null;
  dpeClass: string | null;
  dpeDate: string | null;
  status: LeadStatus;
  notes: string | null;
  assignedTo: string | null;
  mlFeedback: MlFeedback;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
}

export interface Filters {
  minScore: number;
  signalType: 'all' | SignalType;
  status: 'all' | LeadStatus;
  assignedTo: 'all' | 'unassigned' | string;
  quickFilter: QuickFilter;
  dpeUnder30Only: boolean;
}

export const EMPTY_FILTERS: Filters = {
  minScore: 0,
  signalType: 'all',
  status: 'all',
  assignedTo: 'all',
  quickFilter: 'all',
  dpeUnder30Only: false,
};

export function leadHasCompanyEvent(lead: Pick<Lead, 'signals'>): boolean {
  return lead.signals.some((s) => (COMPANY_EVENT_SIGNALS as readonly string[]).includes(s.type));
}

export function isSciDirectorPending(lead: Pick<Lead, 'ownerType' | 'companyDirector'>): boolean {
  return lead.ownerType === 'entreprise' && lead.companyDirector === null;
}

export { countActiveFilters } from '@/lib/filter-state';
