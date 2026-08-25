'use client';

import type { TeamMember } from '@/types/lead';
import Select from '@/components/ui/Select';

export default function PipelineFilters({
  scope,
  onScope,
  negotiatorId,
  onNegotiator,
  members,
  showNegotiator,
  kpiLine,
}: {
  scope: 'mine' | 'agency';
  onScope: (scope: 'mine' | 'agency') => void;
  negotiatorId: string;
  onNegotiator: (id: string) => void;
  members: readonly TeamMember[];
  showNegotiator: boolean;
  kpiLine: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex rounded-xl bg-black/[0.05] p-0.5"
          role="group"
          aria-label="Périmètre des leads"
        >
          <button
            type="button"
            onClick={() => onScope('mine')}
            className={`min-h-[36px] rounded-[10px] px-3 text-[12.5px] font-semibold ${
              scope === 'mine' ? 'bg-surface text-text-strong shadow-clay-sm' : 'text-text-muted'
            }`}
          >
            Mes leads
          </button>
          <button
            type="button"
            onClick={() => onScope('agency')}
            className={`min-h-[36px] rounded-[10px] px-3 text-[12.5px] font-semibold ${
              scope === 'agency' ? 'bg-surface text-text-strong shadow-clay-sm' : 'text-text-muted'
            }`}
          >
            Toute l&apos;agence
          </button>
        </div>
        {showNegotiator ? (
          <Select
            aria-label="Négociateur"
            value={negotiatorId}
            onChange={onNegotiator}
            options={[
              { value: '', label: 'Tous les négociateurs' },
              ...members.map((m) => ({ value: m.id, label: m.fullName })),
            ]}
          />
        ) : null}
      </div>
      <p className="text-[13px] text-text-muted">{kpiLine}</p>
    </div>
  );
}
