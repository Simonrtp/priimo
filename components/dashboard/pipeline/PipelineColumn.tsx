'use client';

import { useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Pencil } from 'lucide-react';
import { stageColumnTheme } from '@/lib/pipeline/stage-theme';
import type { Lead, LeadStage, TeamMember } from '@/types/lead';
import PipelineLeadCard from './PipelineLeadCard';

export default function PipelineColumn({
  stage,
  leads,
  membersById,
  onOpen,
  celebrateTick = 0,
  onEditStage,
}: {
  stage: LeadStage;
  leads: Lead[];
  membersById: Map<string, TeamMember>;
  onOpen: (id: string) => void;
  celebrateTick?: number;
  onEditStage?: (stage: LeadStage) => void;
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
      className={`flex min-h-[420px] w-[300px] shrink-0 self-start rounded-xl ${pulse ? 'pipeline-column-celebrate' : ''}`}
      style={{ backgroundColor: isOver ? theme.bgOver : theme.bg }}
      aria-label={`${stage.libelle}, ${leads.length} carte${leads.length > 1 ? 's' : ''}`}
    >
      <header className="flex shrink-0 items-start justify-between gap-2 px-3 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              className="truncate border-l-[3px] pl-2 text-[13.5px] font-semibold text-text-strong"
              style={{ borderColor: theme.accent }}
            >
              {stage.libelle}
            </h2>
            {onEditStage ? (
              <button
                type="button"
                onClick={() => onEditStage(stage)}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-text-subtle transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] hover:text-text"
                aria-label={`Modifier la colonne ${stage.libelle}`}
                title="Modifier la colonne"
              >
                <Pencil size={14} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        <span className="tabular-nums pt-0.5 text-[12px] text-text-muted">{leads.length}</span>
      </header>
      <div ref={setNodeRef} className="flex-1 px-2 pb-3">
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
