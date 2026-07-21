import type { LeadMlFeedbackDb, LeadOwnerTypeDb, LeadStatusDb } from '@/types/database';
import type { DisplaySignals } from '@/lib/display-signals';
import type { LeadFilters } from '@/lib/lead-filters';
import { EMPTY_LEAD_FILTERS } from '@/lib/lead-filters';

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

export type SignalCategory =
  | 'profil_bien'
  | 'cycle_detention'
  | 'marche_valeur'
  | 'evenements_vie'
  | 'copropriete'
  | 'dpe';

export interface LeadSignal {
  /** Type backend (ex. duree_detention, dpe_classe) ou type legacy Priimo. */
  type: string;
  label: string;
  pts: number;
  source: string;
  /** Catégorie fournie par le pipeline. Optionnelle (legacy). */
  category?: SignalCategory | string | null;
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
  /** Source de vérité pour le panneau de détail (familles + tooltips). */
  displaySignals: DisplaySignals;
  latitude: number | null;
  longitude: number | null;
  acquiredYear: number | null;
  acquiredPrice: number | null;
  /** Faux si le pipeline a marqué le prix d'achat comme non fiable. Null = inconnu (traité comme fiable). */
  acquiredPriceReliable: boolean | null;
  estimatedValue: number | null;
  estimationLow: number | null;
  estimationHigh: number | null;
  estimationConfidence: string | null;
  estimationBasis: string | null;
  plusValuePct: number | null;
  rooms: number | null;
  /** @deprecated colonne héritée VIDE — ne jamais utiliser. Voir `etage`. */
  floor: number | null;
  /** Étage sous forme texte : "RDC", "1", "2"… (source de vérité). */
  etage: string | null;
  dpeClass: string | null;
  dpeDate: string | null;
  status: LeadStatus;
  notes: string | null;
  assignedTo: string | null;
  mlFeedback: MlFeedback;
  mlFeedbackReason: string | null;
  mlFeedbackAt: string | null;
  /** Vérification marché : présence sur les portails à la livraison. NULL = non vérifié (leads antérieurs). */
  marcheStatut: string | null;
  /** Horodatage ISO de la vérification marché par le pipeline. */
  marcheVerifieLe: string | null;
  /** Date du lot pipeline (YYYY-MM-DD). */
  deliveredAt: string;
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

export type Filters = LeadFilters;

export const EMPTY_FILTERS = EMPTY_LEAD_FILTERS;

export function leadHasCompanyEvent(lead: Pick<Lead, 'signals'>): boolean {
  return lead.signals.some((s) => (COMPANY_EVENT_SIGNALS as readonly string[]).includes(s.type));
}

export function isSciDirectorPending(lead: Pick<Lead, 'ownerType' | 'companyDirector'>): boolean {
  return lead.ownerType === 'entreprise' && lead.companyDirector === null;
}

export {
  countActiveLeadFilters as countActiveFilters,
  leadFiltersAreDirty as filtersAreDirty,
  resetLeadFilters as resetFilters,
  patchLeadFilters as patchFilters,
} from '@/lib/lead-filters';
