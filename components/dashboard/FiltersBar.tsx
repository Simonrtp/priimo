'use client';

import { Download, Map } from 'lucide-react';
import type { Agent, Filters, Lead, LeadZoneId, SignalType, LeadStatus } from '@/types/lead';

interface ZoneOpt { id: LeadZoneId; label: string }

interface FiltersBarProps {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  agents: Agent[];
  zones: ZoneOpt[];
  leadsForExport: Lead[];
}

const signalPills: { value: 'all' | SignalType; label: string }[] = [
  { value: 'all',            label: 'Tous'             },
  { value: 'liquidation_pro', label: 'Événement de vie' },
  { value: 'dpe_recent',     label: 'DPE récent'       },
  { value: 'detention_longue', label: 'Détention'      },
  { value: 'plus_value',     label: 'Plus-value'       },
];

const statusPills: { value: 'all' | LeadStatus; label: string }[] = [
  { value: 'all',           label: 'Tous'          },
  { value: 'nouveau',       label: 'Nouveau'       },
  { value: 'contacté',      label: 'Contacté'      },
  { value: 'intéressé',     label: 'Intéressé'     },
  { value: 'rdv_pris',      label: 'RDV pris'      },
  { value: 'pas_intéressé', label: 'Pas intéressé' },
];

function Pill({
  label, active, onClick, activeClass,
}: {
  label: string; active: boolean; onClick: () => void; activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full font-medium transition-colors duration-150 ${
        active ? activeClass : 'bg-black/[0.05] text-mute hover:bg-black/[0.09] hover:text-ink'
      }`}
      style={{ fontSize: 11.5, padding: '4px 12px', letterSpacing: '0.01em' }}
    >
      {label}
    </button>
  );
}

const selectClass =
  'border border-black/8 rounded-xl px-3 py-2 text-ink bg-white focus:outline-none focus:border-accent/40 cursor-pointer text-[13px] min-w-[140px]';

const actionBtn =
  'inline-flex items-center gap-2 border border-black/10 rounded-xl bg-white text-mute hover:text-ink hover:border-black/20 hover:bg-black/[0.02] transition-all duration-150 font-medium flex-shrink-0';

export default function FiltersBar({
  filters,
  onFiltersChange,
  agents,
  zones,
  leadsForExport,
}: FiltersBarProps) {
  const reset = () =>
    onFiltersChange({ minScore: 0, signalType: 'all', status: 'all', assignedTo: 'all', zoneId: 'all' });

  const isDirty =
    filters.minScore > 0 ||
    filters.signalType !== 'all' ||
    filters.status !== 'all' ||
    filters.assignedTo !== 'all' ||
    filters.zoneId !== 'all';

  const openMaps = () => {
    const q =
      leadsForExport.length > 0
        ? `${(leadsForExport.reduce((s, l) => s + l.lat, 0) / leadsForExport.length).toFixed(5)},${(leadsForExport.reduce((s, l) => s + l.lng, 0) / leadsForExport.length).toFixed(5)}`
        : '48.8566,2.3522';
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-black/8 px-5 py-4 mb-4">
      <div className="flex items-center gap-5 mb-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="uppercase text-mute tracking-widest" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
            Score min
          </span>
          <input
            type="range" min={0} max={100} step={5}
            value={filters.minScore}
            onChange={(e) => onFiltersChange({ ...filters, minScore: +e.target.value })}
            className="w-20 accent-accent"
          />
          <span className="font-bold tabular text-accent-dark w-5 text-right" style={{ fontSize: 12 }}>
            {filters.minScore}
          </span>
        </div>

        <div className="w-px bg-black/10 self-stretch min-h-[16px]" />

        <div className="flex items-center gap-1.5 flex-wrap">
          {signalPills.map((p) => (
            <Pill
              key={p.value}
              label={p.label}
              active={filters.signalType === p.value}
              onClick={() => onFiltersChange({ ...filters, signalType: p.value })}
              activeClass={
                p.value === 'all'
                  ? 'bg-ink text-canvas'
                  : 'bg-accent/15 text-accent-dark'
              }
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="uppercase text-mute tracking-widest mr-1" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
            Statut
          </span>
          {statusPills.map((p) => (
            <Pill
              key={p.value}
              label={p.label}
              active={filters.status === p.value}
              onClick={() => onFiltersChange({ ...filters, status: p.value })}
              activeClass={
                p.value === 'all'      ? 'bg-ink text-canvas'
                : p.value === 'nouveau'       ? 'bg-blue/15 text-blue-dark'
                : p.value === 'contacté'      ? 'bg-accent/15 text-accent-dark'
                : p.value === 'intéressé'     ? 'bg-emerald-500/15 text-emerald-700'
                : p.value === 'rdv_pris'      ? 'bg-violet-500/15 text-violet-800'
                : 'bg-black/[0.1] text-mute'
              }
            />
          ))}
        </div>
        {isDirty && (
          <button
            type="button"
            onClick={reset}
            className="text-mute hover:text-ink transition-colors uppercase tracking-widest flex-shrink-0"
            style={{ fontSize: 9, letterSpacing: '0.15em' }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between pt-3 border-t border-black/[0.06]">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="uppercase text-mute tracking-widest whitespace-nowrap" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
              Assigné à
            </span>
            <select
              className={selectClass}
              value={filters.assignedTo}
              onChange={(e) => onFiltersChange({ ...filters, assignedTo: e.target.value as Filters['assignedTo'] })}
            >
              <option value="all">Tous</option>
              <option value="unassigned">Non assigné</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="uppercase text-mute tracking-widest whitespace-nowrap" style={{ fontSize: 9, letterSpacing: '0.15em' }}>
              Zone
            </span>
            <select
              className={selectClass}
              value={filters.zoneId}
              onChange={(e) => onFiltersChange({ ...filters, zoneId: e.target.value as Filters['zoneId'] })}
            >
              <option value="all">Toutes les zones</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            className={actionBtn}
            style={{ padding: '8px 14px', fontSize: 12.5 }}
            onClick={() => console.log('Export CSV', leadsForExport)}
          >
            <Download size={14} strokeWidth={1.8} />
            Exporter CSV
          </button>
          <button
            type="button"
            className={actionBtn}
            style={{ padding: '8px 14px', fontSize: 12.5 }}
            onClick={openMaps}
          >
            <Map size={14} strokeWidth={1.8} />
            Voir sur la carte
          </button>
        </div>
      </div>
    </div>
  );
}
