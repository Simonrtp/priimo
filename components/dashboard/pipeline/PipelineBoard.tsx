'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import type { Lead, LeadStage, TeamMember } from '@/types/lead';
import { fractionalPosition, positionNeighbors } from '@/lib/pipeline/position';
import { patchLeadPipeline } from '@/lib/pipeline/patch';
import { celebratePipelineVictory, pipelineVictoryKind } from '@/lib/pipeline/victories';
import PipelineColumn from './PipelineColumn';
import PipelineLeadCard from './PipelineLeadCard';
import LostReasonDialog from './LostReasonDialog';

type Columns = Record<string, string[]>;

function buildColumns(stages: readonly LeadStage[], leads: readonly Lead[]): Columns {
  const cols: Columns = {};
  for (const stage of stages) cols[stage.id] = [];
  const staged = [...leads]
    .filter((lead) => lead.stageId && cols[lead.stageId] !== undefined)
    .sort((a, b) => (a.stagePosition ?? 0) - (b.stagePosition ?? 0) || a.id.localeCompare(b.id));
  for (const lead of staged) cols[lead.stageId!]?.push(lead.id);
  return cols;
}

function findContainer(id: UniqueIdentifier, columns: Columns): string | null {
  const key = String(id);
  if (key in columns) return key;
  return Object.keys(columns).find((stageId) => columns[stageId]?.includes(key)) ?? null;
}

export default function PipelineBoard({
  stages,
  leads,
  teamMembers,
  onLeadsChange,
  onOpen,
}: {
  stages: readonly LeadStage[];
  leads: Lead[];
  teamMembers: readonly TeamMember[];
  onLeadsChange: (next: Lead[] | ((prev: Lead[]) => Lead[])) => void;
  onOpen: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [columns, setColumns] = useState<Columns>(() => buildColumns(stages, leads));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingLost, setPendingLost] = useState<{
    leadId: string;
    toStageId: string;
    destIds: string[];
    snapshotCols: Columns;
  } | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [mandatCelebrateTick, setMandatCelebrateTick] = useState(0);

  const leadsById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const stagesById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const membersById = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers]);

  useEffect(() => {
    if (activeId || pendingLost) return;
    setColumns(buildColumns(stages, leads));
  }, [stages, leads, activeId, pendingLost]);

  const persistMove = useCallback(
    async (leadId: string, toStageId: string, destIds: string[], lostReasonValue?: string) => {
      const previousLead = leadsById.get(leadId);
      if (!previousLead) return;
      const index = Math.max(0, destIds.indexOf(leadId));
      const neighbors = positionNeighbors(
        destIds.map((id) => ({
          id,
          stagePosition: id === leadId ? null : (leadsById.get(id)?.stagePosition ?? null),
        })),
        index,
        leadId,
      );
      const stagePosition = fractionalPosition(neighbors.previous, neighbors.next);
      const now = new Date().toISOString();
      const toStage = stagesById.get(toStageId);

      onLeadsChange((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                stageId: toStageId,
                stagePosition,
                stageChangedAt: now,
                lostReason: toStage?.type === 'perdu' ? lostReasonValue ?? lead.lostReason : null,
              }
            : lead,
        ),
      );

      const patch = {
        stageId: toStageId,
        stagePosition,
        stageChangedAt: now,
        ...(toStage?.type === 'perdu' && lostReasonValue
          ? { lostReason: lostReasonValue }
          : toStage?.type !== 'perdu'
            ? { lostReason: null }
            : {}),
      };
      try {
        await patchLeadPipeline(leadId, patch);
        const fromStage = previousLead.stageId ? stagesById.get(previousLead.stageId) : null;
        const victory = toStage ? pipelineVictoryKind(fromStage, toStage) : null;
        if (victory) {
          celebratePipelineVictory(victory);
          if (victory === 'mandat') setMandatCelebrateTick((t) => t + 1);
        }
      } catch (e) {
        onLeadsChange((prev) => prev.map((lead) => (lead.id === leadId ? previousLead : lead)));
        toast.error(e instanceof Error ? e.message : 'Le déplacement n’a pas pu être enregistré.');
      }
    },
    [leadsById, onLeadsChange, stagesById],
  );

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const from = findContainer(active.id, columns);
    const to = findContainer(over.id, columns);
    if (!from || !to || from === to) return;

    setColumns((prev) => {
      const fromItems = [...(prev[from] ?? [])];
      const toItems = [...(prev[to] ?? [])];
      const fromIndex = fromItems.indexOf(String(active.id));
      if (fromIndex < 0) return prev;
      fromItems.splice(fromIndex, 1);
      const overIndex = toItems.indexOf(String(over.id));
      const insertAt = overIndex >= 0 ? overIndex : toItems.length;
      toItems.splice(insertAt, 0, String(active.id));
      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const leadId = String(active.id);
    setActiveId(null);
    if (!over) {
      setColumns(buildColumns(stages, leads));
      return;
    }

    const from = findContainer(leadId, buildColumns(stages, leads));
    const to = findContainer(over.id, columns);
    if (!from || !to) {
      setColumns(buildColumns(stages, leads));
      return;
    }

    let nextCols = columns;
    if (from === to) {
      const items = columns[to] ?? [];
      const oldIndex = items.indexOf(leadId);
      const overIndex = items.indexOf(String(over.id));
      if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) {
        nextCols = { ...columns, [to]: arrayMove(items, oldIndex, overIndex) };
        setColumns(nextCols);
      }
    }

    let destIds = [...(nextCols[to] ?? [])];
    if (!destIds.includes(leadId)) {
      destIds.push(leadId);
      nextCols = {
        ...nextCols,
        [from]: (nextCols[from] ?? []).filter((id) => id !== leadId),
        [to]: destIds,
      };
      setColumns(nextCols);
    }
    const toStage = stagesById.get(to);

    if (toStage?.type === 'perdu' && from !== to) {
      setPendingLost({
        leadId,
        toStageId: to,
        destIds,
        snapshotCols: buildColumns(stages, leads),
      });
      setLostReason('');
      return;
    }

    if (
      from === to &&
      destIds.indexOf(leadId) === (buildColumns(stages, leads)[from] ?? []).indexOf(leadId)
    ) {
      return;
    }

    void persistMove(leadId, to, destIds);
  }

  function cancelLost() {
    if (!pendingLost) return;
    setColumns(pendingLost.snapshotCols);
    setPendingLost(null);
    setLostReason('');
  }

  const activeLead = activeId ? leadsById.get(activeId) : null;
  const activeStage = activeLead?.stageId ? stagesById.get(activeLead.stageId) : undefined;

  if (stages.length === 0) {
    return (
      <p className="text-pretty text-[13.5px] text-text-muted">
        Les étapes du pipeline ne sont pas encore disponibles pour cette agence.
      </p>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setColumns(buildColumns(stages, leads));
        }}
      >
        <div className="flex h-[calc(100dvh-16rem)] min-h-[420px] gap-3 overflow-x-auto pb-2">
          {stages.map((stage) => (
            <PipelineColumn
              key={stage.id}
              stage={stage}
              leads={(columns[stage.id] ?? [])
                .map((id) => leadsById.get(id))
                .filter((lead): lead is Lead => Boolean(lead))}
              membersById={membersById}
              onOpen={onOpen}
              celebrateTick={stage.cle === 'mandat' ? mandatCelebrateTick : 0}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <div className="w-[276px]">
              <PipelineLeadCard
                lead={activeLead}
                stage={activeStage}
                assignee={activeLead.assignedTo ? membersById.get(activeLead.assignedTo) : undefined}
                overlay
                onOpen={() => undefined}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LostReasonDialog
        open={pendingLost !== null}
        reason={lostReason}
        onReason={setLostReason}
        onCancel={cancelLost}
        onConfirm={() => {
          if (!pendingLost || !lostReason) return;
          const { leadId, toStageId, destIds } = pendingLost;
          setPendingLost(null);
          void persistMove(leadId, toStageId, destIds, lostReason);
        }}
      />
    </>
  );
}
