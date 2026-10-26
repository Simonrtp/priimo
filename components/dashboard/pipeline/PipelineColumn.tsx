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
  survolee = false,
}: {
  stage: LeadStage;
  leads: Lead[];
  membersById: Map<string, TeamMember>;
  onOpen: (id: string) => void;
  celebrateTick?: number;
  onEditStage?: (stage: LeadStage) => void;
  /** Une carte en vol vise cette colonne, au-dessus d'une carte ou du vide. */
  survolee?: boolean;
}) {
  // Toute la colonne reçoit, en-tête compris : on lâche où l'on veut.
  const { setNodeRef } = useDroppable({ id: stage.id });
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
      ref={setNodeRef}
      className={`flex w-[300px] shrink-0 flex-col self-stretch overflow-hidden rounded-clay-lg transition-colors duration-150 ease-out ${
        pulse ? 'pipeline-column-celebrate' : ''
      }`}
      style={{ backgroundColor: survolee ? theme.bgOver : theme.bg }}
      aria-label={`${stage.libelle}, ${leads.length} carte${leads.length > 1 ? 's' : ''}`}
    >
      <header className="flex shrink-0 items-start justify-between gap-2 px-3 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          {onEditStage ? (
            <button
              type="button"
              onClick={() => onEditStage(stage)}
              className="flex w-full min-w-0 items-center gap-2 rounded-lg text-left transition-colors duration-fluid-subtle ease-in-out hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label={`Modifier la colonne ${stage.libelle}`}
              title="Modifier le nom et la couleur"
            >
              <h2
                className="min-w-0 truncate border-l-[3px] pl-2 text-[13.5px] font-semibold text-text-strong"
                style={{ borderColor: theme.accent }}
              >
                {stage.libelle}
              </h2>
              <Pencil
                size={14}
                strokeWidth={2}
                className="shrink-0 text-text-subtle"
                aria-hidden
              />
            </button>
          ) : (
            <h2
              className="truncate border-l-[3px] pl-2 text-[13.5px] font-semibold text-text-strong"
              style={{ borderColor: theme.accent }}
            >
              {stage.libelle}
            </h2>
          )}
        </div>
        <span className="pt-0.5 text-[12px] tabular-nums text-text-muted">{leads.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2.5 pb-3">
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {leads.map((lead) => (
              <li key={lead.id} className="min-w-0">
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
