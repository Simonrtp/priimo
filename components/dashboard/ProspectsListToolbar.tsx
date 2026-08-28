'use client';

import { SlidersHorizontal } from 'lucide-react';

interface ProspectsListToolbarProps {
  count: number;
  filterActiveCount?: number;
  onOpenFilters?: () => void;
}

export default function ProspectsListToolbar({
  count,
  filterActiveCount = 0,
  onOpenFilters,
}: ProspectsListToolbarProps) {
  const label = `${count} prospect${count !== 1 ? 's' : ''} trouvé${count !== 1 ? 's' : ''}`;
  const hasActiveFilters = filterActiveCount > 0;

  return (
    <>
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-2">
          <p
            className="min-w-0 truncate font-semibold tabular-nums text-ink"
            style={{ fontSize: 14 }}
          >
            {count} prospect{count !== 1 ? 's' : ''}
          </p>
          {onOpenFilters ? (
            <button
              type="button"
              onClick={onOpenFilters}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-clay px-3 text-[13px] font-semibold transition-[box-shadow,color] duration-fluid-subtle ease-in-out ${
                hasActiveFilters
                  ? 'bg-primary-50 text-primary-600 shadow-clay-inset'
                  : 'bg-surface text-text shadow-clay-sm'
              }`}
            >
              <SlidersHorizontal size={16} strokeWidth={2} aria-hidden />
              Filtres{hasActiveFilters ? ` (${filterActiveCount})` : ''}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-3 hidden flex-wrap items-center justify-between gap-4 md:flex">
        <p className="font-semibold tabular-nums text-ink" style={{ fontSize: 14 }}>
          {label}
        </p>
      </div>
    </>
  );
}
