/**
 * Types domaine dashboard — réexporte le module canonique et expose l’alias `Owner`.
 */
export type {
  Agent,
  Filters,
  Lead,
  LeadOwner,
  LeadSegment,
  LeadSegmentTab,
  LeadStatus,
  LeadZoneId,
  LegalForm,
  LifeEvent,
  ProspectOutcome,
  SignalFilterValue,
  SignalType,
} from '@/types/lead';

export { EVENEMENT_SOCIETE_SIGNALS, leadHasEvenementSociete } from '@/types/lead';

/** Alias demandé côté spec : équivalent à `owner` sur `Lead`. */
export type Owner = 'enterprise' | 'individual';
