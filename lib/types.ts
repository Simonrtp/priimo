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
  SignalType,
} from '@/types/lead';

/** Alias demandé côté spec : équivalent à `owner` sur `Lead`. */
export type Owner = 'enterprise' | 'individual';
