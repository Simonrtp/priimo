'use client';

import type { TeamMember } from '@/types/lead';
import Select from '@/components/ui/Select';
import { assigneeSelectAvatar } from '@/components/dashboard/workspace/AssigneeSelect';
import Pastilles from '@/components/ui/Pastilles';

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
        <Pastilles
          label="Périmètre des leads"
          value={scope}
          options={
            [
              { id: 'mine' as const, label: 'Mes leads' },
              { id: 'agency' as const, label: "Toute l'agence" },
            ] as const
          }
          onChange={onScope}
        />
        {showNegotiator ? (
          <Select
            aria-label="Négociateur"
            value={negotiatorId}
            onChange={onNegotiator}
            options={[
              { value: '', label: 'Tous les négociateurs' },
              ...members.map((m) => ({
                value: m.id,
                label: m.fullName,
                avatar: assigneeSelectAvatar(m),
              })),
            ]}
          />
        ) : null}
      </div>
      <p className="text-[13px] text-text-muted">{kpiLine}</p>
    </div>
  );
}
