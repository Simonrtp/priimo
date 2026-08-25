'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Lead, LeadStage, TeamMember } from '@/types/lead';
import PipelineLeadCard from './PipelineLeadCard';

export default function PipelineColumn({
  stage,
  leads,
  membersById,
  onOpen,
}: {
  stage: LeadStage;
  leads: Lead[];
  membersById: Map<string, TeamMember>;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <section
      className="flex h-full w-[300px] shrink-0 flex-col rounded-xl"
      style={{ backgroundColor: isOver ? '#F3E2D0' : '#FFF7F0' }}
      aria-label={`${stage.libelle}, ${leads.length} carte${leads.length > 1 ? 's' : ''}`}
    >
      <header className="flex shrink-0 items-baseline justify-between gap-2 px-3 pb-2 pt-3">
        <h2 className="truncate text-[13.5px] font-semibold text-text-strong">{stage.libelle}</h2>
        <span className="tabular-nums text-[12px] text-text-muted">{leads.length}</span>
      </header>
      <div ref={setNodeRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {leads.map((lead) => (
              <li key={lead.id}>
                <PipelineLeadCard
                  lead={lead}
                  stage={stage}
                  assignee={lead.assignedTo ? membersById.get(lead.assignedTo) : undefined}
                  onOpen={onOpen}
                />
              </li>
            ))}
          </ul>
        </SortableContext>
      </div>
    </section>
  );
}
