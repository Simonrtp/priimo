'use client';

import { useCallback } from 'react';
import type { Lead, TeamMember } from '@/types/lead';
import { notifyError, notifySuccess } from '@/lib/notify';
import Select from '@/components/ui/Select';

interface LeadAssigneeControlProps {
  lead: Lead;
  teamMembers: TeamMember[];
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  /** Conservé pour compat — tous les agents ont le menu d’assignation. */
  canAssignAnyone?: boolean;
  currentUserId?: string | null;
  selectTriggerClassName: string;
}

export default function LeadAssigneeControl({
  lead,
  teamMembers,
  onUpdateLead,
  currentUserId,
  selectTriggerClassName,
}: LeadAssigneeControlProps) {
  const handleAssign = useCallback(
    async (memberId: string | null) => {
      try {
        await onUpdateLead(lead.id, { assignedTo: memberId });
        if (memberId == null) {
          notifySuccess('Lead non assigné', { id: `assign-${lead.id}` });
        } else if (memberId === currentUserId) {
          notifySuccess('Lead assigné à vous', { id: `assign-${lead.id}` });
        } else {
          const name = teamMembers.find((m) => m.id === memberId)?.fullName ?? 'un collègue';
          notifySuccess(`Lead assigné à ${name}`, { id: `assign-${lead.id}` });
        }
      } catch (e) {
        notifyError(e instanceof Error ? e.message : "Erreur lors de l'assignation.");
      }
    },
    [currentUserId, lead.id, onUpdateLead, teamMembers],
  );

  return (
    <div>
      <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
        Assigné à
      </p>
      <div onClick={(e) => e.stopPropagation()}>
        <Select
          aria-label="Assigné à"
          value={lead.assignedTo ?? ''}
          triggerClassName={selectTriggerClassName}
          options={[
            { value: '', label: 'Non assigné' },
            ...teamMembers.map((m) => ({ value: m.id, label: m.fullName })),
          ]}
          onChange={(v) => handleAssign(v === '' ? null : v)}
        />
      </div>
    </div>
  );
}
