import type { Lead } from '@/types/lead';
import { getDetentionYears } from '@/lib/lead-display';
import { isDpeUnder30Days } from '@/lib/lead-dpe';
/** Familles affichables issues de `display_signals`. */
export type DisplayFamilyKey =
  | 'dpe'
  | 'cascade'
  | 'copropriete'
  | 'evenements_vie'
  | 'entreprise';

export type ScoreTierFilter = 'all' | 'ultra_hot' | 'hot';

export const DISPLAY_FAMILY_LABELS: Record<DisplayFamilyKey, string> = {
  dpe: 'DPE',
  cascade: 'Cascade de vente',
  copropriete: 'Copropriété',
  evenements_vie: 'Événements de vie',
  entreprise: 'Événement société',
};

export const SCORE_TIER_LABELS: Record<ScoreTierFilter, string> = {
  all: 'Tous',
  ultra_hot: '🔥 Ultra chaud (≥ 80)',
  hot: '🟠 Chaud (60-79)',
};

export interface LeadFilters {
  scoreTier: ScoreTierFilter;
  minScore: number;
  /** Filtre sur une famille de signaux (display_signals). */
  signalFamily: 'all' | DisplayFamilyKey;
  /** DPE classe F ou G. */
  passoireOnly: boolean;
  /** Diagnostic refait depuis moins de 30 jours. */
  dpeUnder30Only: boolean;
  /** Propriétaire depuis 5 à 9 ans (DVF). */
  detention5to9: boolean;
  /** Prix d'achat DVF jugé fiable par le pipeline. */
  prixAchatConnu: boolean;
  status: Lead['status'] | 'all';
  assignedTo: 'all' | 'unassigned' | string;
}

export const EMPTY_LEAD_FILTERS: LeadFilters = {
  scoreTier: 'all',
  minScore: 0,
  signalFamily: 'all',
  passoireOnly: false,
  dpeUnder30Only: false,
  detention5to9: false,
  prixAchatConnu: false,
  status: 'all',
  assignedTo: 'all',
};

const DISPLAY_FAMILY_ORDER: DisplayFamilyKey[] = [
  'dpe',
  'cascade',
  'copropriete',
  'evenements_vie',
  'entreprise',
];

export function leadHasDisplayFamily(
  lead: Pick<Lead, 'displaySignals'>,
  family: DisplayFamilyKey,
): boolean {
  const ds = lead.displaySignals;
  switch (family) {
    case 'dpe':
      return ds.dpe !== null;
    case 'cascade':
      return ds.cascade !== null;
    case 'copropriete':
      return ds.copropriete !== null;
    case 'evenements_vie':
      return ds.evenementsVie !== null;
    case 'entreprise':
      return ds.entreprise !== null;
    default:
      return false;
  }
}

export function availableDisplayFamilies(leads: Pick<Lead, 'displaySignals'>[]): DisplayFamilyKey[] {
  const set = new Set<DisplayFamilyKey>();
  for (const lead of leads) {
    for (const key of DISPLAY_FAMILY_ORDER) {
      if (leadHasDisplayFamily(lead, key)) set.add(key);
    }
  }
  return DISPLAY_FAMILY_ORDER.filter((k) => set.has(k));
}

function normalizeDpeLetter(lead: Pick<Lead, 'dpeClass' | 'displaySignals'>): string | null {
  const fromDisplay = lead.displaySignals.dpe?.classe;
  if (fromDisplay) return fromDisplay.toUpperCase();
  if (lead.dpeClass) return lead.dpeClass.trim().toUpperCase().charAt(0);
  return null;
}

/** Passoire thermique : DPE F ou G (colonne ou display_signals). */
export function isPassoireLead(lead: Pick<Lead, 'dpeClass' | 'displaySignals' | 'signals'>): boolean {
  const letter = normalizeDpeLetter(lead);
  if (letter === 'F' || letter === 'G') return true;
  return lead.signals.some(
    (s) =>
      s.type === 'dpe_passoire' ||
      s.type === 'dpe_classe' ||
      /passoire/i.test(s.label),
  );
}

export function hasPrixAchatConnu(lead: Pick<Lead, 'displaySignals'>): boolean {
  return lead.displaySignals.plusValue?.available === true;
}

function matchesScoreTier(lead: Pick<Lead, 'score'>, tier: ScoreTierFilter): boolean {
  switch (tier) {
    case 'ultra_hot':
      return lead.score >= 80;
    case 'hot':
      return lead.score >= 60 && lead.score < 80;
    default:
      return true;
  }
}

export function matchesLeadFilters(lead: Lead, filters: LeadFilters): boolean {
  if (lead.score < filters.minScore) return false;
  if (!matchesScoreTier(lead, filters.scoreTier)) return false;

  if (filters.signalFamily !== 'all' && !leadHasDisplayFamily(lead, filters.signalFamily)) {
    return false;
  }

  if (filters.passoireOnly && !isPassoireLead(lead)) return false;
  if (filters.dpeUnder30Only && !isDpeUnder30Days(lead)) return false;

  if (filters.detention5to9) {
    const years = getDetentionYears(lead.acquiredYear);
    if (years == null || years < 5 || years > 9) return false;
  }

  if (filters.prixAchatConnu && !hasPrixAchatConnu(lead)) return false;

  if (filters.status !== 'all' && lead.status !== filters.status) return false;

  if (filters.assignedTo === 'unassigned') {
    if (lead.assignedTo != null) return false;
  } else if (filters.assignedTo !== 'all') {
    if (lead.assignedTo !== filters.assignedTo) return false;
  }

  return true;
}

const SCORE_TIERS = new Set<ScoreTierFilter>(['ultra_hot', 'hot']);

export function patchLeadFilters(prev: LeadFilters, patch: Partial<LeadFilters>): LeadFilters {
  const next: LeadFilters = { ...prev, ...patch };

  if (patch.scoreTier !== undefined && patch.scoreTier !== 'all') {
    next.minScore = 0;
  }

  if (patch.minScore !== undefined && patch.minScore > 0 && SCORE_TIERS.has(next.scoreTier)) {
    next.scoreTier = 'all';
  }

  return next;
}

export function countActiveLeadFilters(
  f: LeadFilters,
  opts?: { countAssigned?: boolean },
): number {
  const countAssigned = opts?.countAssigned !== false;
  let n = 0;
  if (f.scoreTier !== 'all') n++;
  if (f.minScore > 0) n++;
  if (f.signalFamily !== 'all') n++;
  if (f.passoireOnly) n++;
  if (f.dpeUnder30Only) n++;
  if (f.detention5to9) n++;
  if (f.prixAchatConnu) n++;
  if (f.status !== 'all') n++;
  if (countAssigned && f.assignedTo !== 'all') n++;
  return n;
}

export function leadFiltersAreDirty(f: LeadFilters, opts?: { countAssigned?: boolean }): boolean {
  return countActiveLeadFilters(f, opts) > 0;
}

export function resetLeadFilters(): LeadFilters {
  return { ...EMPTY_LEAD_FILTERS };
}

/** Au moins un filtre « bien » ou « signaux » disponible dans la liste. */
export function showPropertyFilterSection(
  leads: Pick<Lead, 'displaySignals' | 'dpeClass' | 'dpeDate' | 'acquiredYear' | 'signals'>[],
): {
  passoire: boolean;
  dpeUnder30: boolean;
  detention5to9: boolean;
  prixAchat: boolean;
} {
  return {
    passoire: leads.some((l) => isPassoireLead(l)),
    dpeUnder30: leads.some((l) => l.dpeDate != null),
    detention5to9: leads.some((l) => getDetentionYears(l.acquiredYear) != null),
    prixAchat: leads.some((l) => hasPrixAchatConnu(l)),
  };
}
