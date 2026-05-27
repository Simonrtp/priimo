'use client';

import type { QuickFilter } from '@/lib/lead-display';
import { QUICK_FILTER_LABELS } from '@/lib/lead-display';

const CHIP_FILTERS: QuickFilter[] = [
  'ultra_hot',
  'hot',
  'passoire',
  'dpe_recent',
  'detention_5_9',
];

const ALL_FILTERS: QuickFilter[] = ['all', ...CHIP_FILTERS];

interface ProspectQuickFiltersProps {
  value: QuickFilter;
  onChange: (filter: QuickFilter) => void;
  /** Intégré dans ProspectsFiltersPanel (sans marge externe). */
  embedded?: boolean;
}

export default function ProspectQuickFilters({
  value,
  onChange,
  embedded = false,
}: ProspectQuickFiltersProps) {
  return (
    <div className={embedded ? '' : 'mb-4'}>
      <p
        className="mb-2 uppercase tracking-widest text-mute"
        style={{ fontSize: 9, letterSpacing: '0.15em' }}
      >
        Raccourcis
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ALL_FILTERS.map((key) => {
          const active = value === key;
          const label = QUICK_FILTER_LABELS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key === 'all' ? 'all' : value === key ? 'all' : key)}
              className={`rounded-full font-medium transition-colors duration-150 ${
                active
                  ? 'bg-ink text-canvas'
                  : 'bg-black/[0.05] text-mute hover:bg-black/[0.09] hover:text-ink'
              }`}
              style={{ fontSize: 11.5, padding: '5px 12px', letterSpacing: '0.01em' }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
