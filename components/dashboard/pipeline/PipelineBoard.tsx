'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
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
import { validerEnFond } from '@/lib/ui/valider-en-fond';
import type { Lead, LeadStage, TeamMember } from '@/types/lead';
import { fractionalPosition, positionNeighbors } from '@/lib/pipeline/position';
import { patchLeadPipeline } from '@/lib/pipeline/patch';
import { celebratePipelineVictory, pipelineVictoryKind } from '@/lib/pipeline/victories';
import WorkspaceButton from '@/components/dashboard/workspace/WorkspaceButton';
import PipelineColumn from './PipelineColumn';
import PipelineLeadCard from './PipelineLeadCard';
import LostReasonDialog from './LostReasonDialog';
import StageEditorDialog from './StageEditorDialog';
import { COULEUR_COLONNE_DEFAUT } from '@/lib/pipeline/stage-theme';

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
  canManageStages = false,
  onStagesChange,
}: {
  stages: readonly LeadStage[];
  leads: Lead[];
  teamMembers: readonly TeamMember[];
  onLeadsChange: (next: Lead[] | ((prev: Lead[]) => Lead[])) => void;
  onOpen: (id: string) => void;
  canManageStages?: boolean;
  onStagesChange?: (next: LeadStage[] | ((prev: LeadStage[]) => LeadStage[])) => void;
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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageLabel, setStageLabel] = useState('');
  const [stageColor, setStageColor] = useState(COULEUR_COLONNE_DEFAUT);
  const [stageError, setStageError] = useState<string | null>(null);

  const leadsById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const stagesById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const membersById = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers]);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingStageId(null);
    setStageLabel('');
    setStageColor(COULEUR_COLONNE_DEFAUT);
    setStageError(null);
  }, []);

  const openCreateEditor = useCallback(() => {
    setEditorMode('create');
    setEditingStageId(null);
    setStageLabel('');
    setStageColor(COULEUR_COLONNE_DEFAUT);
    setStageError(null);
    setEditorOpen(true);
  }, []);

  const openEditEditor = useCallback((stage: LeadStage) => {
    setEditorMode('edit');
    setEditingStageId(stage.id);
    setStageLabel(stage.libelle);
    setStageColor(stage.accentColor);
    setStageError(null);
    setEditorOpen(true);
  }, []);

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

  const submitStageEditor = useCallback(() => {
    const libelle = stageLabel.trim().replace(/\s+/g, ' ');
    if (libelle.length < 2) {
      setStageError('Le nom doit contenir au moins 2 caractères.');
      return;
    }
    if (!/^#[0-9a-f]{6}$/i.test(stageColor)) {
      setStageError('Choisissez une couleur valide.');
      return;
    }

    const mode = editorMode;
    const stageId = editingStageId;
    const couleur = stageColor;
    closeEditor();
    validerEnFond({
      succes: mode === 'create' ? 'Colonne créée' : 'Colonne mise à jour',
      echec: "La colonne n'a pas pu être enregistrée",
      ecrire: async () => {
        const endpoint =
          mode === 'create' ? '/api/dashboard/lead-stages' : `/api/dashboard/lead-stages/${stageId}`;
        const res = await fetch(endpoint, {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ libelle, accentColor: couleur }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          stage?: LeadStage;
        };
        if (!res.ok || !body.stage) {
          throw new Error(body.error ?? "La colonne n'a pas pu être enregistrée");
        }
        return body.stage;
      },
      puis: (stage) => {
        onStagesChange?.((prev) => {
          const list = Array.isArray(prev) ? prev : stages;
          const next =
            mode === 'create'
              ? [...list, stage]
              : list.map((item) => (item.id === stage.id ? stage : item));
          return [...next].sort((a, b) => a.ordre - b.ordre);
        });
      },
    });
  }, [closeEditor, editorMode, editingStageId, onStagesChange, stageColor, stageLabel, stages]);

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
        <div className="flex min-h-[420px] items-stretch gap-3 overflow-x-auto overflow-y-visible pb-2 pr-1">
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
              onEditStage={canManageStages ? openEditEditor : undefined}
            />
          ))}
          {canManageStages ? (
            <section className="flex min-h-[420px] w-[300px] shrink-0 flex-col self-stretch rounded-clay-lg border border-dashed border-black/[0.12] bg-white/70 p-4">
              <div className="flex h-full flex-col items-start justify-center gap-3 rounded-xl bg-black/[0.02] px-4 text-left">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <Plus size={20} strokeWidth={2.2} aria-hidden />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-text-strong">Nouvelle colonne</h3>
                  <p className="mt-1 text-pretty text-[13px] text-text-muted">
                    Choisis une couleur, puis un nom pour ajouter une étape intermédiaire.
                  </p>
                </div>
                <WorkspaceButton
                  type="button"
                  variant="secondary"
                  onClick={openCreateEditor}
                  className="w-full"
                >
                  Ajouter une colonne
                </WorkspaceButton>
              </div>
            </section>
          ) : null}
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

      <StageEditorDialog
        open={editorOpen}
        mode={editorMode}
        libelle={stageLabel}
        accentColor={stageColor}
        saving={false}
        error={stageError}
        onLibelleChange={setStageLabel}
        onAccentColorChange={setStageColor}
        onCancel={closeEditor}
        onConfirm={submitStageEditor}
      />
    </>
  );
}
