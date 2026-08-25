'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import type { Lead, LeadStage, TeamMember } from '@/types/lead';
import ScoreRing from '@/components/dashboard/ScoreRing';
import FacadeLead from '@/components/dashboard/FacadeLead';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { formatPrice } from '@/lib/utils';
import { daysSinceTaken, isStaleEntree } from '@/lib/pipeline/stale';

function metaLine(lead: Lead): string {
  const parts = [
    lead.propertyType,
    lead.surfaceM2 != null ? `${lead.surfaceM2} m²` : null,
    lead.estimatedValue != null ? `${formatPrice(lead.estimatedValue)} €` : null,
  ].filter((p): p is string => Boolean(p));
  return parts.join(' · ');
}

export default function PipelineLeadCard({
  lead,
  stage,
  assignee,
  overlay = false,
  onOpen,
}: {
  lead: Lead;
  stage: LeadStage | undefined;
  assignee: TeamMember | undefined;
  overlay?: boolean;
  onOpen: (id: string) => void;
}) {
  const sortable = useSortable({ id: lead.id, disabled: overlay });
  const stale = isStaleEntree(stage?.type, lead.takenAt);
  const days = daysSinceTaken(lead.takenAt);
  const style: CSSProperties = overlay
    ? { transform: 'rotate(2deg)' }
    : {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.4 : 1,
      };
  const suppressClick = sortable.isDragging || Boolean(sortable.transform);

  return (
    <article
      ref={overlay ? undefined : sortable.setNodeRef}
      style={style}
      {...(overlay ? {} : sortable.attributes)}
      {...(overlay ? {} : sortable.listeners)}
      onClick={() => {
        if (!overlay && !suppressClick) onOpen(lead.id);
      }}
      className={`cursor-grab overflow-hidden rounded-xl border border-black/[0.08] bg-white text-left ${
        overlay ? 'cursor-grabbing shadow-[0_12px_28px_-8px_rgba(21,32,47,0.28)]' : ''
      }`}
    >
      <div className="relative h-[90px] overflow-hidden bg-[#F1EFE8]">
        <FacadeLead leadId={lead.id} format="liste" lazy className="pointer-events-none h-[90px] w-full rounded-none" />
        <div className="absolute right-2 top-2">
          <ScoreRing score={lead.score} size={28} />
        </div>
      </div>
      <div className="px-2.5 pb-2.5 pt-2">
        <p className="truncate font-medium text-text-strong" style={{ fontSize: 14 }}>
          {lead.address}
        </p>
        <p className="mt-0.5 truncate text-text-muted" style={{ fontSize: 12 }}>
          {metaLine(lead) || '—'}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          {stale && days != null ? (
            <InfoTooltip
              content={`Pris il y a ${days} jour${days > 1 ? 's' : ''}, jamais contacté`}
              placement="top-start"
            >
              <span
                className="size-2 rounded-full bg-accent"
                aria-label={`Pris il y a ${days} jours, jamais contacté`}
              />
            </InfoTooltip>
          ) : (
            <span />
          )}
          {assignee ? (
            <span
              className="flex size-[22px] items-center justify-center rounded-full bg-black/[0.06] text-[9px] font-semibold text-text-strong"
              title={assignee.fullName}
              aria-label={assignee.fullName}
            >
              {assignee.initials}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
