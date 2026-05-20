import type { QuickFilter } from '@/lib/lead-display';
import type { Filters, SignalType } from '@/types/lead';
import { EMPTY_FILTERS } from '@/types/lead';

/** Signaux déjà couverts par les raccourcis — pas de pills en double. */
const SIGNALS_COVERED_BY_SHORTCUTS = new Set<SignalType>([
  'dpe_recent',
  'dpe_passoire',
  'detention_longue',
]);

const SCORE_SHORTCUTS = new Set<QuickFilter>(['ultra_hot', 'hot']);

export function advancedSignalTypes(available: SignalType[]): SignalType[] {
  return available.filter((t) => !SIGNALS_COVERED_BY_SHORTCUTS.has(t));
}

export function patchFilters(prev: Filters, patch: Partial<Filters>): Filters {
  const next: Filters = { ...prev, ...patch };

  if (patch.quickFilter !== undefined && patch.quickFilter !== 'all') {
    next.signalType = 'all';
  }

  if (patch.signalType !== undefined && patch.signalType !== 'all') {
    next.quickFilter = 'all';
  }

  if (patch.minScore !== undefined && patch.minScore > 0 && SCORE_SHORTCUTS.has(next.quickFilter)) {
    next.quickFilter = 'all';
  }

  return next;
}

export function resetFilters(): Filters {
  return { ...EMPTY_FILTERS };
}

export function filtersAreDirty(f: Filters, opts?: { countAssigned?: boolean }): boolean {
  return countActiveFilters(f, opts) > 0;
}

export function countActiveFilters(f: Filters, opts?: { countAssigned?: boolean }): number {
  const countAssigned = opts?.countAssigned !== false;
  let n = 0;
  if (f.minScore > 0) n++;
  if (f.signalType !== 'all') n++;
  if (f.status !== 'all') n++;
  if (f.quickFilter !== 'all') n++;
  if (countAssigned && f.assignedTo !== 'all') n++;
  return n;
}
