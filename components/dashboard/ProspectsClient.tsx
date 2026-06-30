'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import type { Filters, Lead, LeadSegmentTab, TeamMember } from '@/types/lead';
import { EMPTY_FILTERS } from '@/types/lead';
import {
  countActiveLeadFilters,
  matchesLeadFilters,
  sanitizeSignalFamilyForLeads,
  sanitizeSortByForLeads,
} from '@/lib/lead-filters';
import { partitionLeadsForDisplay } from '@/lib/lead-delivery';
import { sortProspects } from '@/lib/lead-dpe';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  deleteLead as deleteLeadDb,
  updateLead as updateLeadDb,
  updateLeadCoordinates,
} from '@/lib/queries/leads';
import TabsNav from './TabsNav';
import ProspectsFiltersPanel from './ProspectsFiltersPanel';
import ProspectsListToolbar, { type ProspectsViewMode } from './ProspectsListToolbar';
import ProspectsFiltersSheet from './ProspectsFiltersSheet';
import LeadsList from './LeadsList';

const LeadMapView = dynamic(() => import('./map/LeadMapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-240px)] min-h-[480px] items-center justify-center rounded-2xl border border-black/8 bg-[#F4F4F2] text-sm text-mute shadow-soft">
      Chargement de la carte…
    </div>
  ),
});
import LeadDrawer from './LeadDrawer';
import LeadFullScreenMobile from './LeadFullScreenMobile';
import PipelineUpdateBanner from './PipelineUpdateBanner';

interface ProspectsClientProps {
  initialLeads: Lead[];
  teamMembers: TeamMember[];
  isDirector: boolean;
  initialShowPipelineBanner: boolean;
  initialNewBatchCount: number;
}

function matchesSegmentTab(lead: Lead, tab: LeadSegmentTab): boolean {
  if (tab === 'tous') return true;
  if (tab === 'entreprises') return lead.ownerType === 'entreprise';
  return lead.ownerType === 'particulier';
}

function toCsvValue(input: unknown): string {
  if (input == null) return '';
  const s = String(input);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportLeadsToCsv(leads: Lead[]) {
  const header = [
    'Adresse',
    'Ville',
    'Code postal',
    'Type',
    'Score',
    'Statut',
    'Société',
    'Dirigeant',
    'Téléphone',
    'Email',
    'Surface m²',
    'Année acquisition',
    'Prix acquisition',
    'Valeur estimée',
    'DPE',
  ];
  const rows = leads.map((l) => [
    l.address,
    l.city ?? '',
    l.postalCode ?? '',
    l.propertyType ?? '',
    l.score,
    l.status,
    l.companyName ?? '',
    l.companyDirector ?? '',
    l.companyPhone ?? '',
    l.companyEmail ?? '',
    l.surfaceM2 ?? '',
    l.acquiredYear ?? '',
    l.acquiredPrice ?? '',
    l.estimatedValue ?? '',
    l.dpeClass ?? '',
  ]);
  const csv = [header, ...rows].map((line) => line.map(toCsvValue).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ProspectsClient({
  initialLeads,
  teamMembers,
  isDirector,
  initialShowPipelineBanner,
  initialNewBatchCount,
}: ProspectsClientProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [showPipelineBanner, setShowPipelineBanner] = useState(initialShowPipelineBanner);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [segmentTab, setSegmentTab] = useState<LeadSegmentTab>('tous');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [prospectsView, setProspectsView] = useState<ProspectsViewMode>('liste');
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

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

  const filtered = useMemo(
    () => segmentLeads.filter((l) => matchesLeadFilters(l, filters)),
    [segmentLeads, filters],
  );

  const partitioned = useMemo(
    () => partitionLeadsForDisplay(filtered, leads, filters.sortBy),
    [filtered, leads, filters.sortBy],
  );

  const filteredForExport = useMemo(
    () => sortProspects(filtered, filters.sortBy),
    [filtered, filters.sortBy],
  );

  const selected = selectedLeadId ? leads.find((l) => l.id === selectedLeadId) ?? null : null;

  const applyLeadPatch = useCallback((id: string, patch: Partial<Lead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const updateLeadHandler = useCallback(
    async (id: string, patch: Partial<Lead>) => {
      const previous = leads.find((l) => l.id === id);
      if (!previous) return;
      applyLeadPatch(id, patch);
      try {
        await updateLeadDb(supabase, id, {
          status: patch.status,
          notes: patch.notes,
          assignedTo: patch.assignedTo,
          mlFeedback: patch.mlFeedback,
          mlFeedbackReason: patch.mlFeedbackReason,
          mlFeedbackAt: patch.mlFeedbackAt,
        });
      } catch (e) {
        applyLeadPatch(id, previous);
        throw e;
      }
    },
    [applyLeadPatch, leads, supabase],
  );

  const handleLeadGeocoded = useCallback(
    (id: string, latitude: number, longitude: number) => {
      applyLeadPatch(id, { latitude, longitude });
      void updateLeadCoordinates(supabase, id, latitude, longitude).catch(() => {
        // échec de persistance non bloquant : la carte reste à jour en mémoire
      });
    },
    [applyLeadPatch, supabase],
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

  const deleteLeadHandler = useCallback(
    async (id: string) => {
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
    [leads, supabase],
  );

  const filterCount = countActiveLeadFilters(filters, { countAssigned: isDirector });
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

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

  return (
    <div className="w-full min-w-0">
      {showPipelineBanner && initialNewBatchCount > 0 && (
        <PipelineUpdateBanner
          newCount={initialNewBatchCount}
          onDismiss={() => void dismissPipelineBanner()}
          onViewNew={viewNewLeads}
        />
      )}

      <div className="mb-3 max-md:pt-4 md:mb-3">
        <TabsNav value={segmentTab} onTabChange={setSegmentTab} counts={tabCounts} />

        <ProspectsListToolbar
          count={filtered.length}
          viewMode={prospectsView}
          onViewModeChange={(v) => {
            setProspectsView(v);
            if (v === 'carte') setSelectedLeadId(null);
          }}
          onExportCsv={isDirector ? () => exportLeadsToCsv(filteredForExport) : undefined}
          filterActiveCount={filterCount}
          onOpenFilters={() => setFiltersSheetOpen(true)}
          showExportCsv={isDirector}
        />
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

      {prospectsView === 'liste' ? (
        <LeadsList
          newBatch={partitioned.newBatch}
          previousGroups={partitioned.previousGroups}
          filters={filters}
          segmentTab={segmentTab}
          hasAnyLead={leads.length > 0}
          onLeadClick={setSelectedLeadId}
          onStatusChange={onStatusInline}
          onResetFilters={resetFilters}
        />
      ) : (
        <LeadMapView
          leads={filtered}
          onOpenDetail={setSelectedLeadId}
          onGeocoded={handleLeadGeocoded}
        />
      )}

      <LeadDrawer
        lead={selected}
        onClose={() => setSelectedLeadId(null)}
        onUpdateLead={updateLeadHandler}
        onDeleteLead={deleteLeadHandler}
        canAssignLead={isDirector}
        teamMembers={teamMembers}
      />
      {selected && (
        <LeadFullScreenMobile
          lead={selected}
          onClose={() => setSelectedLeadId(null)}
          onUpdateLead={updateLeadHandler}
          onDeleteLead={deleteLeadHandler}
          canAssignLead={isDirector}
          teamMembers={teamMembers}
        />
      )}
    </div>
  );
}
