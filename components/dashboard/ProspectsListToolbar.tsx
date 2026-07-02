'use client';

import { SlidersHorizontal } from 'lucide-react';
import { ICONS, ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';

export type ProspectsViewMode = 'liste' | 'carte';

/** Couleur du token primaire pour les icônes lucide (color accepte une var CSS). */
const PRIMARY_600 = 'var(--primary-600)';

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
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-2">
          <p
            className="min-w-0 truncate font-semibold tabular text-ink"
            style={{ fontSize: 14, letterSpacing: '-0.01em' }}
          >
            {count} prospect{count !== 1 ? 's' : ''}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {onOpenFilters && (
              <button
                type="button"
                onClick={onOpenFilters}
                className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-clay px-3 text-[13px] font-semibold transition-[box-shadow,color] duration-200 ease-clay ${
                  hasActiveFilters
                    ? 'bg-primary-50 text-primary-600 shadow-clay-inset'
                    : 'bg-surface text-text shadow-clay-sm'
                }`}
              >
                <SlidersHorizontal size={16} strokeWidth={2} aria-hidden />
                Filtres{hasActiveFilters ? ` (${filterActiveCount})` : ''}
              </button>
            )}
            <div
              className="inline-flex rounded-2xl bg-surface p-1 shadow-clay-sm"
              role="group"
              aria-label="Mode d’affichage"
              data-tour="view-toggle-mobile"
            >
              <button
                type="button"
                onClick={() => onViewModeChange('liste')}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[14px] transition-[box-shadow,color] duration-200 ease-clay ${
                  viewMode === 'liste' ? 'bg-primary-50 text-primary-600 shadow-clay-inset' : 'text-text-muted'
                }`}
                aria-label="Liste"
                aria-pressed={viewMode === 'liste'}
              >
                <ICONS.list size={ICON_SIZE.md} color={viewMode === 'liste' ? PRIMARY_600 : ICON_COLORS.neutral} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('carte')}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[14px] transition-[box-shadow,color] duration-200 ease-clay ${
                  viewMode === 'carte' ? 'bg-primary-50 text-primary-600 shadow-clay-inset' : 'text-text-muted'
                }`}
                aria-label="Carte"
                aria-pressed={viewMode === 'carte'}
              >
                <ICONS.map size={ICON_SIZE.md} color={viewMode === 'carte' ? PRIMARY_600 : ICON_COLORS.neutral} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-3 hidden flex-wrap items-center justify-between gap-4 md:flex">
        <p className="font-semibold tabular text-ink" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
          {label}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex rounded-2xl bg-surface p-1 shadow-clay-sm"
            role="group"
            aria-label="Mode d’affichage"
            data-tour="view-toggle"
          >
            <button
              type="button"
              onClick={() => onViewModeChange('liste')}
              className={`inline-flex items-center gap-1.5 rounded-[14px] px-3.5 py-2 font-medium transition-[box-shadow,color] duration-200 ease-clay ${
                viewMode === 'liste'
                  ? 'bg-primary-50 text-primary-600 shadow-clay-inset'
                  : 'bg-transparent text-text-muted hover:text-text'
              }`}
              style={{ fontSize: 13 }}
            >
              <ICONS.list size={ICON_SIZE.md} color={viewMode === 'liste' ? PRIMARY_600 : ICON_COLORS.neutral} strokeWidth={2} />
              Liste
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('carte')}
              className={`inline-flex items-center gap-1.5 rounded-[14px] px-3.5 py-2 font-medium transition-[box-shadow,color] duration-200 ease-clay ${
                viewMode === 'carte'
                  ? 'bg-primary-50 text-primary-600 shadow-clay-inset'
                  : 'bg-transparent text-text-muted hover:text-text'
              }`}
              style={{ fontSize: 13 }}
            >
              <ICONS.map size={ICON_SIZE.md} color={viewMode === 'carte' ? PRIMARY_600 : ICON_COLORS.neutral} strokeWidth={2} />
              Carte
            </button>
          </div>

          {showExportCsv && onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-2 rounded-clay border-none bg-surface font-medium text-text-muted shadow-clay-sm transition-[transform,box-shadow,color] duration-200 ease-clay hover:-translate-y-0.5 hover:text-primary-600 hover:shadow-clay active:translate-y-0 active:shadow-clay-pressed"
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
