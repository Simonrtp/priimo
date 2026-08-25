'use client';

import { useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { stageColumnTheme } from '@/lib/pipeline/stage-theme';
import type { Lead, LeadStage, TeamMember } from '@/types/lead';
import PipelineLeadCard from './PipelineLeadCard';

export default function PipelineColumn({
  stage,
  leads,
  membersById,
  onOpen,
  celebrateTick = 0,
}: {
  stage: LeadStage;
  leads: Lead[];
  membersById: Map<string, TeamMember>;
  onOpen: (id: string) => void;
  celebrateTick?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const theme = stageColumnTheme(stage);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!celebrateTick) return;
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), 1700);
    return () => window.clearTimeout(timer);
  }, [celebrateTick]);

  return (
    <section
      className={`flex h-full w-[300px] shrink-0 flex-col rounded-xl ${pulse ? 'pipeline-column-celebrate' : ''}`}
      style={{ backgroundColor: isOver ? theme.bgOver : theme.bg }}
      aria-label={`${stage.libelle}, ${leads.length} carte${leads.length > 1 ? 's' : ''}`}
    >
      <header className="flex shrink-0 items-baseline justify-between gap-2 px-3 pb-2 pt-3">
        <h2
          className="truncate border-l-[3px] pl-2 text-[13.5px] font-semibold text-text-strong"
          style={{ borderColor: theme.accent }}
        >
          {stage.libelle}
        </h2>
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
