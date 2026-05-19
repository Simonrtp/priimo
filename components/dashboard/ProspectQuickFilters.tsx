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

interface ProspectQuickFiltersProps {
  value: QuickFilter;
  onChange: (filter: QuickFilter) => void;
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-shrink-0 rounded-full font-medium transition-colors duration-150 ${
        active
          ? 'bg-ink text-canvas shadow-sm'
          : 'border border-black/10 bg-white text-ink hover:border-black/15 hover:bg-black/[0.02]'
      }`}
      style={{ fontSize: 12, padding: '6px 14px' }}
    >
      {label}
    </button>
  );
}

export default function ProspectQuickFilters({ value, onChange }: ProspectQuickFiltersProps) {
  return (
    <div className="mb-4">
      <p
        className="mb-2 uppercase tracking-widest text-mute"
        style={{ fontSize: 9, letterSpacing: '0.15em' }}
      >
        Filtres rapides
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Chip
          label={QUICK_FILTER_LABELS.all}
          active={value === 'all'}
          onClick={() => onChange('all')}
        />
        {CHIP_FILTERS.map((key) => (
          <Chip
            key={key}
            label={QUICK_FILTER_LABELS[key]}
            active={value === key}
            onClick={() => onChange(value === key ? 'all' : key)}
          />
        ))}
      </div>
    </div>
  );
}
