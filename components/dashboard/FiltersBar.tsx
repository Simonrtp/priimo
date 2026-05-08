'use client';

import type { Filters } from '@/types/lead';

interface FiltersBarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const signalOptions = [
  { value: 'all', label: 'Tous' },
  { value: 'liquidation_pro', label: 'Événement de vie' },
  { value: 'dpe_recent', label: 'DPE récent' },
  { value: 'detention_longue', label: 'Détention longue' },
  { value: 'plus_value', label: 'Plus-value élevée' },
] as const;

const statusOptions = [
  { value: 'all', label: 'Tous' },
  { value: 'nouveau', label: 'Nouveau' },
  { value: 'contacté', label: 'Contacté' },
  { value: 'intéressé', label: 'Intéressé' },
  { value: 'pas_intéressé', label: 'Pas intéressé' },
] as const;

const selectClass =
  'border border-[#E5E5E5] rounded-[6px] bg-white text-gray-900 focus:outline-none focus:border-[#2563EB] cursor-pointer';

export default function FiltersBar({ filters, onFiltersChange }: FiltersBarProps) {
  return (
    <div className="flex items-center gap-4 mb-6 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="font-medium text-gray-700 whitespace-nowrap" style={{ fontSize: '13px' }}>
          Score min
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minScore}
          onChange={(e) =>
            onFiltersChange({ ...filters, minScore: Number(e.target.value) })
          }
          className="w-24 accent-[#2563EB]"
        />
        <span className="font-bold text-[#2563EB] w-8" style={{ fontSize: '14px' }}>
          {filters.minScore}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label className="font-medium text-gray-700" style={{ fontSize: '13px' }}>
          Signal
        </label>
        <select
          value={filters.signalType}
          onChange={(e) =>
            onFiltersChange({ ...filters, signalType: e.target.value as Filters['signalType'] })
          }
          className={selectClass}
          style={{ padding: '8px 12px', fontSize: '14px' }}
        >
          {signalOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="font-medium text-gray-700" style={{ fontSize: '13px' }}>
          Statut
        </label>
        <select
          value={filters.status}
          onChange={(e) =>
            onFiltersChange({ ...filters, status: e.target.value as Filters['status'] })
          }
          className={selectClass}
          style={{ padding: '8px 12px', fontSize: '14px' }}
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => onFiltersChange({ minScore: 0, signalType: 'all', status: 'all' })}
        className="font-medium text-gray-500 hover:text-gray-900 transition-colors duration-100 ml-auto"
        style={{ fontSize: '14px' }}
      >
        Réinitialiser
      </button>
    </div>
  );
}
