'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { colonneVoisine } from '@/lib/pipeline/colonne';
import { notifyError, notifySuccess } from '@/lib/notify';
import { validerEnFond } from '@/lib/ui/valider-en-fond';
import type { Lead, LeadStage, TeamMember } from '@/types/lead';
import { fractionalPosition, positionNeighbors } from '@/lib/pipeline/position';
import { patchLeadPipeline } from '@/lib/pipeline/patch';
import { celebratePipelineVictory, pipelineVictoryKind } from '@/lib/pipeline/victories';
import { invaliderNavigationApresLead } from '@/app/dashboard/_actions/invalider-navigation';
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

const abonnementVide = () => () => {};

const DEPOT: DropAnimation = {
  duration: 180,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.35' } } }),
};

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
  // Souris : on glisse dès 5 px. Doigt : appui court, sinon le tableau ne défile plus.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [columns, setColumns] = useState<Columns>(() => buildColumns(stages, leads));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [largeurVol, setLargeurVol] = useState<number | null>(null);
  const [colonneSurvolee, setColonneSurvolee] = useState<string | null>(null);
  const monte = useSyncExternalStore(
    abonnementVide,
    () => true,
    () => false,
  );
  const columnsRef = useRef(columns);
  useLayoutEffect(() => {
    columnsRef.current = columns;
  }, [columns]);
  const departRef = useRef<{ colonnes: Columns; stageId: string } | null>(null);
  const dernierSurvol = useRef<UniqueIdentifier | null>(null);
  const vientDeChanger = useRef(false);
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
  const [suppression, setSuppression] = useState(false);

  const leadsById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const stagesById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const membersById = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers]);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditingStageId(null);
    setStageLabel('');
    setStageColor(COULEUR_COLONNE_DEFAUT);
    setStageError(null);
    setSuppression(false);
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

  useEffect(() => {
    requestAnimationFrame(() => {
      vientDeChanger.current = false;
    });
  }, [columns]);

  /**
   * Sous le pointeur d'abord : la colonne visée, même vide ou très haute.
   * Dans une colonne garnie, la carte la plus proche donne la place.
   */
  const collision: CollisionDetection = useCallback((args) => {
    const sousLePointeur = pointerWithin(args);
    const touches = sousLePointeur.length > 0 ? sousLePointeur : rectIntersection(args);
    let overId = getFirstCollision(touches, 'id');
    if (overId != null) {
      const cartes = columnsRef.current[String(overId)];
      if (cartes && cartes.length > 0) {
        const proche = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (c) => c.id !== overId && cartes.includes(String(c.id)),
          ),
        })[0]?.id;
        if (proche != null) overId = proche;
      }
      dernierSurvol.current = overId;
      return [{ id: overId }];
    }
    // Juste après un changement de colonne, la mise en page bouge : on garde la cible.
    if (vientDeChanger.current && args.active) dernierSurvol.current = args.active.id;
    return dernierSurvol.current != null ? [{ id: dernierSurvol.current }] : [];
  }, []);

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
        void invaliderNavigationApresLead();
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

  function finirVol() {
    setActiveId(null);
    setColonneSurvolee(null);
    setLargeurVol(null);
    dernierSurvol.current = null;
  }

  function annulerVol() {
    const depart = departRef.current;
    departRef.current = null;
    finirVol();
    setColumns(depart?.colonnes ?? buildColumns(stages, leads));
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const stageId = findContainer(id, columns);
    departRef.current = stageId ? { colonnes: columns, stageId } : null;
    setLargeurVol(event.active.rect.current.initial?.width ?? null);
    setColonneSurvolee(stageId);
    setActiveId(id);
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const from = findContainer(active.id, columns);
    const to = findContainer(over.id, columns);
    if (!from || !to) return;
    setColonneSurvolee(to);
    if (from === to) return;

    // Sous la moitié de la carte visée : on se place après elle.
    const enVol = active.rect.current.translated;
    const dessous = enVol != null && enVol.top + enVol.height / 2 > over.rect.top + over.rect.height / 2;

    vientDeChanger.current = true;
    setColumns((prev) => {
      const fromItems = (prev[from] ?? []).filter((id) => id !== String(active.id));
      const toItems = (prev[to] ?? []).filter((id) => id !== String(active.id));
      const overIndex = toItems.indexOf(String(over.id));
      const insertAt = overIndex >= 0 ? overIndex + (dessous ? 1 : 0) : toItems.length;
      toItems.splice(insertAt, 0, String(active.id));
      return { ...prev, [from]: fromItems, [to]: toItems };
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const leadId = String(active.id);
    const depart = departRef.current;
    departRef.current = null;
    finirVol();
    if (!over || !depart) {
      setColumns(depart?.colonnes ?? buildColumns(stages, leads));
      return;
    }

    const ici = findContainer(leadId, columns);
    const to = findContainer(over.id, columns);
    if (!ici || !to) {
      setColumns(depart.colonnes);
      return;
    }

    let nextCols = columns;
    if (ici === to) {
      const items = columns[to] ?? [];
      const oldIndex = items.indexOf(leadId);
      const overIndex = items.indexOf(String(over.id));
      if (oldIndex >= 0 && overIndex >= 0 && oldIndex !== overIndex) {
        nextCols = { ...columns, [to]: arrayMove(items, oldIndex, overIndex) };
      }
    } else {
      nextCols = {
        ...columns,
        [ici]: (columns[ici] ?? []).filter((id) => id !== leadId),
        [to]: [...(columns[to] ?? []).filter((id) => id !== leadId), leadId],
      };
    }
    setColumns(nextCols);
    const destIds = [...(nextCols[to] ?? [])];
    const from = depart.stageId;

    if (from === to && destIds.indexOf(leadId) === (depart.colonnes[from] ?? []).indexOf(leadId)) {
      return;
    }

    if (stagesById.get(to)?.type === 'perdu' && from !== to) {
      setPendingLost({ leadId, toStageId: to, destIds, snapshotCols: depart.colonnes });
      setLostReason('');
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

  const editingStage = editingStageId ? stagesById.get(editingStageId) : undefined;
  const cartesColonne = editingStage ? leads.filter((lead) => lead.stageId === editingStage.id).length : 0;
  const versColonne = editingStage
    ? colonneVoisine(
        editingStage,
        stages.filter((stage) => stage.id !== editingStage.id),
      )
    : null;

  const supprimerColonne = useCallback(async () => {
    const stage = editingStageId ? stagesById.get(editingStageId) : undefined;
    if (!stage || stage.type === 'entree' || suppression) return;
    setSuppression(true);
    setStageError(null);
    try {
      const res = await fetch(`/api/dashboard/lead-stages/${stage.id}`, { method: 'DELETE' });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        destination?: { id: string; libelle: string };
        leads?: { id: string; stagePosition: number }[];
      };
      if (!res.ok || !body.destination) {
        throw new Error(body.error ?? "La colonne n'a pas pu être supprimée");
      }
      const positions = new Map((body.leads ?? []).map((lead) => [lead.id, lead.stagePosition]));
      const destinationId = body.destination.id;
      if (positions.size > 0) {
        onLeadsChange((prev) =>
          prev.map((lead) => {
            const stagePosition = positions.get(lead.id);
            return stagePosition == null ? lead : { ...lead, stageId: destinationId, stagePosition };
          }),
        );
      }
      onStagesChange?.((prev) => {
        const list = Array.isArray(prev) ? prev : stages;
        return list.filter((item) => item.id !== stage.id);
      });
      notifySuccess(
        positions.size === 0
          ? 'Colonne supprimée'
          : `Colonne supprimée. Les cartes sont dans ${body.destination.libelle}.`,
      );
      closeEditor();
    } catch (err) {
      setSuppression(false);
      const message = err instanceof Error && err.message ? err.message : "La colonne n'a pas pu être supprimée";
      setStageError(message);
      notifyError(message);
    }
  }, [closeEditor, editingStageId, onLeadsChange, onStagesChange, stages, stagesById, suppression]);

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
        collisionDetection={collision}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={annulerVol}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 items-stretch gap-3 overflow-x-auto overflow-y-hidden pb-1 pr-1 [-webkit-overflow-scrolling:touch]">
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
              survolee={activeId != null && colonneSurvolee === stage.id}
            />
          ))}
          {canManageStages ? (
            <section className="flex min-h-0 w-[300px] shrink-0 flex-col self-stretch rounded-clay-lg border border-dashed border-black/[0.12] bg-white/70 p-4">
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
        {/* La carte en vol vit dans <body> : le panneau de travail (contain: paint)
            ferait sinon office de repère et la décalerait de la largeur de la barre. */}
        {monte
          ? createPortal(
              <DragOverlay
                dropAnimation={DEPOT}
                zIndex={60}
                adjustScale={false}
                className="cursor-grabbing"
                style={{}}
                transition={undefined}
              >
                {activeLead ? (
                  <div style={{ width: largeurVol ?? 280 }}>
                    <PipelineLeadCard
                      lead={activeLead}
                      stage={activeStage}
                      assignee={activeLead.assignedTo ? membersById.get(activeLead.assignedTo) : undefined}
                      overlay
                      onOpen={() => undefined}
                    />
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )
          : null}
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
        peutSupprimer={editingStage?.type !== 'entree' && Boolean(versColonne)}
        cartes={cartesColonne}
        vers={versColonne?.libelle ?? null}
        suppression={suppression}
        onSupprimer={() => void supprimerColonne()}
      />
    </>
  );
}
