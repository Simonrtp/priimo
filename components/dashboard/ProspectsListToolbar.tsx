'use client';

import { Download, List, Map } from 'lucide-react';

export type ProspectsViewMode = 'liste' | 'carte';

interface ProspectsListToolbarProps {
  count: number;
  viewMode: ProspectsViewMode;
  onViewModeChange: (mode: ProspectsViewMode) => void;
  onExportCsv: () => void;
}

export default function ProspectsListToolbar({
  count,
  viewMode,
  onViewModeChange,
  onExportCsv,
}: ProspectsListToolbarProps) {
  const label = `${count} prospect${count !== 1 ? 's' : ''} trouvé${count !== 1 ? 's' : ''}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
      <p className="text-ink font-semibold tabular" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
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
            <List size={16} strokeWidth={viewMode === 'liste' ? 2.2 : 1.8} />
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
            <Map size={16} strokeWidth={viewMode === 'carte' ? 2.2 : 1.8} />
            Carte
          </button>
        </div>

        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white text-mute hover:text-ink hover:border-black/20 hover:bg-black/[0.02] transition-all duration-200 font-medium"
          style={{ padding: '8px 14px', fontSize: 13 }}
        >
          <Download size={16} strokeWidth={1.8} />
          Exporter CSV
        </button>
      </div>
    </div>
  );
}
