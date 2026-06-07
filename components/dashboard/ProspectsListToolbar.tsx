'use client';

import { ICONS, ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';

export type ProspectsViewMode = 'liste' | 'carte';

interface ProspectsListToolbarProps {
  count: number;
  viewMode: ProspectsViewMode;
  onViewModeChange: (mode: ProspectsViewMode) => void;
  onExportCsv?: () => void;
  /** Mobile : nombre de filtres actifs (hors défaut). */
  filterActiveCount?: number;
  onOpenFilters?: () => void;
  /** Faux pour le rôle agent : masque « Exporter CSV ». */
  showExportCsv?: boolean;
}

export default function ProspectsListToolbar({
  count,
  viewMode,
  onViewModeChange,
  onExportCsv,
  filterActiveCount = 0,
  onOpenFilters,
  showExportCsv = true,
}: ProspectsListToolbarProps) {
  const label = `${count} prospect${count !== 1 ? 's' : ''} trouvé${count !== 1 ? 's' : ''}`;
  const hasActiveFilters = filterActiveCount > 0;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2 md:hidden">
        <p className="min-w-0 truncate font-semibold tabular text-ink" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
          {count} prospect{count !== 1 ? 's' : ''}
        </p>
        <div className="flex flex-shrink-0 items-center gap-2">
          {onOpenFilters && (
            <button
              type="button"
              onClick={onOpenFilters}
              className={`min-h-[44px] rounded-lg px-3 text-[13px] font-semibold transition-colors ${
                hasActiveFilters
                  ? 'bg-orange-100 text-accent-dark ring-1 ring-accent/25'
                  : 'bg-gray-100 text-ink'
              }`}
            >
              Filtres{hasActiveFilters ? ` (${filterActiveCount})` : ''}
            </button>
          )}
          <div
            className="inline-flex rounded-xl border border-black/10 bg-black/[0.03] p-0.5"
            role="group"
            aria-label="Mode d’affichage"
          >
            <button
              type="button"
              onClick={() => onViewModeChange('liste')}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] transition-colors ${
                viewMode === 'liste' ? 'bg-accent text-white shadow-sm' : 'text-[#374151]'
              }`}
              aria-label="Liste"
            >
              <ICONS.list size={ICON_SIZE.md} color={viewMode === 'liste' ? '#fff' : ICON_COLORS.neutral} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('carte')}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] transition-colors ${
                viewMode === 'carte' ? 'bg-accent text-white shadow-sm' : 'text-[#374151]'
              }`}
              aria-label="Carte"
            >
              <ICONS.map size={ICON_SIZE.md} color={viewMode === 'carte' ? '#fff' : ICON_COLORS.neutral} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-3 hidden flex-wrap items-center justify-between gap-4 md:flex">
        <p className="font-semibold tabular text-ink" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
          {label}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex rounded-xl border border-black/10 bg-black/[0.03] p-0.5"
            role="group"
            aria-label="Mode d’affichage"
          >
            <button
              type="button"
              onClick={() => onViewModeChange('liste')}
              className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 font-medium transition-colors duration-200 ease-out ${
                viewMode === 'liste'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-transparent text-[#374151] hover:text-ink'
              }`}
              style={{ fontSize: 13 }}
            >
              <ICONS.list size={ICON_SIZE.md} color={viewMode === 'liste' ? '#fff' : ICON_COLORS.neutral} strokeWidth={2} />
              Liste
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('carte')}
              className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 font-medium transition-colors duration-200 ease-out ${
                viewMode === 'carte'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-transparent text-[#374151] hover:text-ink'
              }`}
              style={{ fontSize: 13 }}
            >
              <ICONS.map size={ICON_SIZE.md} color={viewMode === 'carte' ? '#fff' : ICON_COLORS.neutral} strokeWidth={2} />
              Carte
            </button>
          </div>

          {showExportCsv && onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white font-medium text-mute transition-all duration-200 hover:border-black/20 hover:bg-black/[0.02] hover:text-ink"
            style={{ padding: '8px 14px', fontSize: 13 }}
          >
            <ICONS.download size={ICON_SIZE.sm} color={ICON_COLORS.neutral} strokeWidth={2} />
            Exporter CSV
          </button>
          )}
        </div>
      </div>
    </>
  );
}
