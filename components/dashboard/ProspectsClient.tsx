'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Filters, Lead, LeadSegmentTab, LeadStage, TeamMember } from '@/types/lead';
import { EMPTY_FILTERS } from '@/types/lead';
import {
  countActiveLeadFilters,
  matchesLeadFilters,
  sanitizeSignalFamilyForLeads,
  sanitizeSortByForLeads,
} from '@/lib/lead-filters';
import { partitionLeadsForDisplay } from '@/lib/lead-delivery';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { deleteLead as deleteLeadDb } from '@/lib/queries/leads';
import { entreeStage } from '@/lib/queries/lead-stages';
import { nextStagePosition } from '@/lib/pipeline/position';
import { patchLeadPipeline } from '@/lib/pipeline/patch';
import { celebratePipelineVictory, pipelineVictoryKind } from '@/lib/pipeline/victories';
import { formatPriseLine, priseStats } from '@/lib/pipeline/prise';
import { useUser } from '@/lib/hooks/useUser';
import { useDevice } from '@/components/dashboard/device/DeviceProvider';
import { pickTourLeadId } from '@/lib/tour-lead';
import TabsNav from './TabsNav';
import ProspectsFiltersPanel from './ProspectsFiltersPanel';
import ProspectsListToolbar from './ProspectsListToolbar';
import ProspectsFiltersSheet from './ProspectsFiltersSheet';
import ProspectsViewSwitch, {
  prospectionHref,
  type ProspectionVue,
} from './ProspectsViewSwitch';
import LeadsList from './LeadsList';
import PipelineUpdateBanner from './PipelineUpdateBanner';
import PipelineBoard from './pipeline/PipelineBoard';
import PipelineFilters from './pipeline/PipelineFilters';
import LostReasonDialog from './pipeline/LostReasonDialog';

const LeadDrawer = dynamic(() => import('./LeadDrawer'), { ssr: false });
const LeadFullScreenMobile = dynamic(() => import('./LeadFullScreenMobile'), { ssr: false });

interface ProspectsClientProps {
  initialLeads: Lead[];
  teamMembers: TeamMember[];
  stages: LeadStage[];
  isDirector: boolean;
  initialShowPipelineBanner: boolean;
  initialNewBatchCount: number;
  initialSelectedLeadId?: string | null;
  listFilter?: 'sans-position' | 'non-assignes-14j' | 'non-pris' | 'estimations' | null;
  memberId?: string | null;
  initialVue?: ProspectionVue;
}

function matchesSegmentTab(lead: Lead, tab: LeadSegmentTab): boolean {
  if (tab === 'tous') return true;
  if (tab === 'entreprises') return lead.ownerType === 'entreprise';
  return lead.ownerType === 'particulier';
}

function useWideViewport(initial: boolean) {
  const [wide, setWide] = useState(initial);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return wide;
}

export default function ProspectsClient({
  initialLeads,
  teamMembers,
  stages,
  isDirector,
  initialShowPipelineBanner,
  initialNewBatchCount,
  initialSelectedLeadId = null,
  listFilter = null,
  memberId = null,
  initialVue = 'liste',
}: ProspectsClientProps) {
  const { profile } = useUser();
  const router = useRouter();
  const device = useDevice();
  const wide = useWideViewport(false);
  const [vueState, setVueState] = useState<ProspectionVue>(initialVue);
  const vueFromUrl = vueState;
  // Terrain : liste seule — le kanban n'a aucun sens au pouce.
  const vue: ProspectionVue =
    device === 'mobile' ? 'liste' : vueFromUrl === 'pipeline' && !wide ? 'liste' : vueFromUrl;

  useEffect(() => {
    setVueState(initialVue);
  }, [initialVue]);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [showPipelineBanner, setShowPipelineBanner] = useState(initialShowPipelineBanner);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialSelectedLeadId);
  const [segmentTab, setSegmentTab] = useState<LeadSegmentTab>('tous');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [pipelineScope, setPipelineScope] = useState<'mine' | 'agency'>('mine');
  const [negotiatorId, setNegotiatorId] = useState('');
  const [pendingLost, setPendingLost] = useState<{ leadId: string; stageId: string } | null>(null);
  const [lostReason, setLostReason] = useState('');

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const tabCounts = useMemo(
    () => ({
      tous: leads.length,
      entreprises: leads.filter((l) => l.ownerType === 'entreprise').length,
      particuliers: leads.filter((l) => l.ownerType === 'particulier').length,
    }),
    [leads],
  );

  const segmentLeads = useMemo(
    () => leads.filter((l) => matchesSegmentTab(l, segmentTab)),
    [leads, segmentTab],
  );

  useEffect(() => {
    setFilters((prev) => {
      let next = sanitizeSignalFamilyForLeads(prev, segmentLeads);
      next = sanitizeSortByForLeads(next, segmentLeads);
      return next === prev ? prev : next;
    });
  }, [segmentTab, segmentLeads]);

  const filtered = useMemo(() => {
    const DAY_MS = 86_400_000;
    return segmentLeads.filter((l) => {
      if (!matchesLeadFilters(l, filters)) return false;
      if (memberId && l.assignedTo !== memberId) return false;
      if (listFilter === 'sans-position' && l.banId) return false;
      if (listFilter === 'non-assignes-14j') {
        if (l.assignedTo) return false;
        const t = Date.parse(l.deliveredAt ?? l.createdAt);
        if (!Number.isFinite(t) || Date.now() - t <= 14 * DAY_MS) return false;
      }
      if (listFilter === 'non-pris' && l.stageId != null) return false;
      if (listFilter === 'estimations') {
        const estimation = stages.find((s) => s.cle === 'estimation');
        if (!estimation || l.stageId !== estimation.id) return false;
      }
      return true;
    });
  }, [segmentLeads, filters, listFilter, memberId, stages]);

  const partitioned = useMemo(
    () =>
      partitionLeadsForDisplay(
        filtered,
        leads,
        listFilter === 'non-pris' ? 'score' : filters.sortBy,
      ),
    [filtered, leads, filters.sortBy, listFilter],
  );

  const pipelineLeads = useMemo(() => {
    const userId = profile?.id;
    return leads.filter((lead) => {
      if (pipelineScope === 'mine' && userId && lead.assignedTo !== userId) return false;
      if (pipelineScope === 'agency' && isDirector && negotiatorId && lead.assignedTo !== negotiatorId) {
        return false;
      }
      return true;
    });
  }, [leads, pipelineScope, profile?.id, isDirector, negotiatorId]);

  const kpiLine = useMemo(() => formatPriseLine(priseStats(leads)), [leads]);

  const selected = selectedLeadId ? (leads.find((l) => l.id === selectedLeadId) ?? null) : null;

  const applyLeadPatch = useCallback((id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const setVue = useCallback(
    (next: ProspectionVue) => {
      setVueState(next);
      const params = new URLSearchParams(window.location.search);
      router.replace(prospectionHref(params, next), { scroll: false });
    },
    [router],
  );

  const updateLeadHandler = useCallback(
    async (id: string, patch: Partial<Lead>) => {
      const previous = leads.find((l) => l.id === id);
      if (!previous) return;
      applyLeadPatch(id, patch);
      try {
        const payload: Record<string, unknown> = {};
        if (patch.status !== undefined) payload.status = patch.status;
        if (patch.notes !== undefined) payload.notes = patch.notes;
        if (patch.assignedTo !== undefined) payload.assignedTo = patch.assignedTo;
        if (patch.mlFeedback !== undefined) payload.mlFeedback = patch.mlFeedback;
        if (patch.mlFeedbackReason !== undefined) payload.mlFeedbackReason = patch.mlFeedbackReason;
        if (patch.mlFeedbackAt !== undefined) payload.mlFeedbackAt = patch.mlFeedbackAt;

        const res = await fetch(`/api/dashboard/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? 'Enregistrement impossible');
        }
      } catch (e) {
        applyLeadPatch(id, previous);
        throw e;
      }
    },
    [applyLeadPatch, leads],
  );

  const onStatusInline = useCallback(
    async (id: string, status: Lead['status']) => {
      try {
        await updateLeadHandler(id, { status });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erreur lors du changement de statut.');
      }
    },
    [updateLeadHandler],
  );

  const onTake = useCallback(
    async (id: string) => {
      const lead = leads.find((l) => l.id === id);
      const gate = entreeStage(stages);
      const userId = profile?.id;
      if (!lead || !gate || !userId) {
        toast.error('Impossible d’ajouter ce lead au pipeline pour le moment.');
        return;
      }
      const now = new Date().toISOString();
      const stagePosition = nextStagePosition(leads, gate.id);
      applyLeadPatch(id, {
        stageId: gate.id,
        stagePosition,
        takenAt: now,
        assignedTo: userId,
        stageChangedAt: now,
      });
      try {
        await patchLeadPipeline(id, {
          stageId: gate.id,
          stagePosition,
          takenAt: now,
          assignedTo: userId,
          stageChangedAt: now,
        });
      } catch (e) {
        applyLeadPatch(id, {
          stageId: lead.stageId,
          stagePosition: lead.stagePosition,
          takenAt: lead.takenAt,
          assignedTo: lead.assignedTo,
          stageChangedAt: lead.stageChangedAt,
        });
        toast.error(e instanceof Error ? e.message : 'Le lead n’a pas pu être ajouté au pipeline.');
      }
    },
    [applyLeadPatch, leads, profile?.id, stages],
  );

  const persistStage = useCallback(
    async (id: string, stageId: string, lostReasonValue?: string) => {
      const lead = leads.find((l) => l.id === id);
      const stage = stages.find((s) => s.id === stageId);
      if (!lead || !stage || lead.stageId === stageId) return;
      const now = new Date().toISOString();
      const stagePosition = nextStagePosition(
        leads.filter((item) => item.id !== id),
        stageId,
      );
      const optimistic: Partial<Lead> = {
        stageId,
        stagePosition,
        stageChangedAt: now,
        lostReason: stage.type === 'perdu' ? lostReasonValue ?? lead.lostReason : null,
      };
      applyLeadPatch(id, optimistic);
      try {
        await patchLeadPipeline(id, {
          stageId,
          stagePosition,
          stageChangedAt: now,
          lostReason: stage.type === 'perdu' ? lostReasonValue ?? null : null,
        });
        const fromStage = lead.stageId ? stages.find((s) => s.id === lead.stageId) : null;
        const victory = pipelineVictoryKind(fromStage, stage);
        if (victory) celebratePipelineVictory(victory);
      } catch (e) {
        applyLeadPatch(id, {
          stageId: lead.stageId,
          stagePosition: lead.stagePosition,
          stageChangedAt: lead.stageChangedAt,
          lostReason: lead.lostReason,
        });
        toast.error(e instanceof Error ? e.message : 'L’étape n’a pas pu être enregistrée.');
      }
    },
    [applyLeadPatch, leads, stages],
  );

  const onStageChange = useCallback(
    (id: string, stageId: string) => {
      const lead = leads.find((l) => l.id === id);
      const stage = stages.find((s) => s.id === stageId);
      if (!lead || !stage || lead.stageId === stageId) return;
      if (stage.type === 'perdu') {
        setPendingLost({ leadId: id, stageId });
        setLostReason('');
        return;
      }
      void persistStage(id, stageId);
    },
    [leads, persistStage, stages],
  );

  const deleteLeadHandler = useCallback(
    async (id: string) => {
      if (!isDirector) {
        toast.error('Seul le directeur peut supprimer un lead.');
        return;
      }
      const previous = leads;
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setSelectedLeadId((current) => (current === id ? null : current));
      try {
        await deleteLeadDb(supabase, id);
        toast.success('Lead supprimé');
      } catch (e) {
        setLeads(previous);
        toast.error(e instanceof Error ? e.message : 'Impossible de supprimer le lead.');
        throw e;
      }
    },
    [isDirector, leads, supabase],
  );

  const filterCount = countActiveLeadFilters(filters, { countAssigned: isDirector });
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  useEffect(() => {
    const openTourLead = () => {
      try {
        sessionStorage.setItem('priimo-tour-expand-contacts', '1');
      } catch {
        // sessionStorage indisponible
      }
      const id = pickTourLeadId(filtered.length > 0 ? filtered : leads);
      if (id) setSelectedLeadId(id);
    };
    const closeLead = () => setSelectedLeadId(null);
    window.addEventListener('priimo-tour:open-lead', openTourLead);
    window.addEventListener('priimo-tour:close-lead', closeLead);
    return () => {
      window.removeEventListener('priimo-tour:open-lead', openTourLead);
      window.removeEventListener('priimo-tour:close-lead', closeLead);
    };
  }, [filtered, leads]);

  const dismissPipelineBanner = useCallback(async () => {
    setShowPipelineBanner(false);
    try {
      const res = await fetch('/api/dashboard/leads-last-seen', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Erreur réseau');
      }
      const data = (await res.json()) as { leadsLastSeenAt?: string };
      if (!data.leadsLastSeenAt) {
        throw new Error('Réponse serveur invalide');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible de marquer les leads comme vus.');
    }
  }, []);

  const viewNewLeads = useCallback(() => {
    document.getElementById('prospects-leads-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    void dismissPipelineBanner();
  }, [dismissPipelineBanner]);

  const switcher =
    device === 'mobile' ? null : <ProspectsViewSwitch value={vue} onChange={setVue} />;

  return (
    <div className="w-full min-w-0 pb-4 pt-2 md:pt-0">
      {showPipelineBanner && initialNewBatchCount > 0 && vue === 'liste' && (
        <PipelineUpdateBanner
          newCount={initialNewBatchCount}
          onDismiss={() => void dismissPipelineBanner()}
          onViewNew={viewNewLeads}
        />
      )}

      {vue === 'pipeline' ? (
        <>
          {switcher ? <div className="mb-4 flex items-center justify-end">{switcher}</div> : null}
          <PipelineFilters
            scope={pipelineScope}
            onScope={setPipelineScope}
            negotiatorId={negotiatorId}
            onNegotiator={setNegotiatorId}
            members={teamMembers}
            showNegotiator={isDirector && pipelineScope === 'agency'}
            kpiLine={kpiLine}
          />
          <PipelineBoard
            stages={stages}
            leads={pipelineLeads}
            teamMembers={teamMembers}
            onLeadsChange={setLeads}
            onOpen={setSelectedLeadId}
          />
        </>
      ) : null}

      {vue === 'liste' ? (
        <>
          <div className="flex flex-col">
            <div className="order-3 mb-3 md:mb-3">
              {switcher ? <div className="mb-3 flex justify-end">{switcher}</div> : null}
              <TabsNav value={segmentTab} onTabChange={setSegmentTab} counts={tabCounts} />

              <ProspectsListToolbar
                count={filtered.length}
                filterActiveCount={filterCount}
                onOpenFilters={() => setFiltersSheetOpen(true)}
              />
            </div>
          </div>

          <div className="mb-4 hidden md:block">
            <ProspectsFiltersPanel
              filters={filters}
              onFiltersChange={setFilters}
              teamMembers={teamMembers}
              leads={segmentLeads}
              showAssignedFilter={isDirector}
            />
          </div>

          <ProspectsFiltersSheet
            open={filtersSheetOpen}
            onClose={() => setFiltersSheetOpen(false)}
            appliedFilters={filters}
            onApply={setFilters}
            teamMembers={teamMembers}
            leads={segmentLeads}
            showAssignedFilter={isDirector}
          />

          <LeadsList
            newBatch={partitioned.newBatch}
            previousGroups={partitioned.previousGroups}
            filters={filters}
            segmentTab={segmentTab}
            hasAnyLead={leads.length > 0}
            onLeadClick={setSelectedLeadId}
            onStatusChange={onStatusInline}
            stages={stages}
            onTake={onTake}
            onStageChange={onStageChange}
            onResetFilters={resetFilters}
          />
        </>
      ) : null}

      <LostReasonDialog
        open={pendingLost !== null}
        reason={lostReason}
        onReason={setLostReason}
        onCancel={() => {
          setPendingLost(null);
          setLostReason('');
        }}
        onConfirm={() => {
          if (!pendingLost || !lostReason) return;
          const { leadId, stageId } = pendingLost;
          setPendingLost(null);
          void persistStage(leadId, stageId, lostReason);
        }}
      />

      <LeadDrawer
        lead={selected}
        onClose={() => setSelectedLeadId(null)}
        onUpdateLead={updateLeadHandler}
        onDeleteLead={deleteLeadHandler}
        canAssignLead
        canDeleteLead={isDirector}
        currentUserId={profile?.id ?? null}
        teamMembers={teamMembers}
      />
      {selected && (
        <LeadFullScreenMobile
          lead={selected}
          onClose={() => setSelectedLeadId(null)}
          onUpdateLead={updateLeadHandler}
          onDeleteLead={deleteLeadHandler}
          canAssignLead
          canDeleteLead={isDirector}
          currentUserId={profile?.id ?? null}
          teamMembers={teamMembers}
        />
      )}
    </div>
  );
}
