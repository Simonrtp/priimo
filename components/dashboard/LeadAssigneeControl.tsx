'use client';

import { useCallback } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { Lead, TeamMember } from '@/types/lead';
import Select from '@/components/ui/Select';

interface LeadAssigneeControlProps {
  lead: Lead;
  teamMembers: TeamMember[];
  onUpdateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  /** Directeur : peut assigner n'importe quel membre via le menu déroulant. */
  canAssignAnyone: boolean;
  /** Collaborateur : peut s'assigner / se retirer le lead. */
  currentUserId?: string | null;
  selectTriggerClassName: string;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-mute" style={{ fontSize: 11 }}>
      {children}
    </p>
  );
}

export default function LeadAssigneeControl({
  lead,
  teamMembers,
  onUpdateLead,
  canAssignAnyone,
  currentUserId,
  selectTriggerClassName,
}: LeadAssigneeControlProps) {
  const handleAssign = useCallback(
    async (memberId: string | null) => {
      try {
        await onUpdateLead(lead.id, { assignedTo: memberId });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur lors de l'assignation.");
      }
    },
    [lead.id, onUpdateLead],
  );

  if (canAssignAnyone) {
    return (
      <div>
        <SectionTitle>Assigné à</SectionTitle>
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

  if (!currentUserId) return null;

  const assignedToSelf = lead.assignedTo === currentUserId;
  const assignedToOther = lead.assignedTo != null && !assignedToSelf;
  const otherName = assignedToOther
    ? teamMembers.find((m) => m.id === lead.assignedTo)?.fullName ?? 'un collègue'
    : null;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <SectionTitle>Assignation</SectionTitle>

      {assignedToSelf ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5">
          <span className="flex items-center gap-2 font-medium text-accent-dark" style={{ fontSize: 13 }}>
            <Check size={15} strokeWidth={2.4} aria-hidden />
            Assigné à vous
          </span>
          <button
            type="button"
            onClick={() => handleAssign(null)}
            className="font-medium text-mute transition-colors hover:text-ink"
            style={{ fontSize: 12 }}
          >
            Me retirer
          </button>
        </div>
      ) : assignedToOther ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-black/8 bg-white px-4 py-2.5">
          <span className="text-mute" style={{ fontSize: 13 }}>
            Assigné à {otherName}
          </span>
          <button
            type="button"
            onClick={() => handleAssign(currentUserId)}
            className="font-medium text-accent-dark transition-colors hover:text-accent"
            style={{ fontSize: 12 }}
          >
            Me l’assigner
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => handleAssign(currentUserId)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 font-semibold text-accent-dark transition-colors hover:bg-accent/10"
          style={{ fontSize: 13 }}
        >
          <UserPlus size={15} strokeWidth={2.2} aria-hidden />
          M’assigner ce lead
        </button>
      )}
    </div>
  );
}
