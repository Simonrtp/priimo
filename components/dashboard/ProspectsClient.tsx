'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type {
  Filters,
  Lead,
  LeadSegmentTab,
  SignalType,
  TeamMember,
} from '@/types/lead';
import { EMPTY_FILTERS, countActiveFilters } from '@/types/lead';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { deleteLead as deleteLeadDb, updateLead as updateLeadDb } from '@/lib/queries/leads';
import { uniqueSignalTypes } from '@/lib/lead-meta';
import { matchesQuickFilter } from '@/lib/lead-display';
import ProspectQuickFilters from './ProspectQuickFilters';
import StatsBar from './StatsBar';
import TabsNav from './TabsNav';
import FiltersBar from './FiltersBar';
import ProspectsListToolbar, { type ProspectsViewMode } from './ProspectsListToolbar';
import ProspectsFiltersSheet from './ProspectsFiltersSheet';
import MapViewPlaceholder from './MapViewPlaceholder';
import LeadsList from './LeadsList';
import LeadDrawer from './LeadDrawer';
import LeadFullScreenMobile from './LeadFullScreenMobile';

interface ProspectsClientProps {
  initialLeads: Lead[];
  teamMembers: TeamMember[];
  isDirector: boolean;
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
}: ProspectsClientProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
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

  const availableSignals = useMemo<SignalType[]>(() => uniqueSignalTypes(leads), [leads]);

  const segmentLeads = useMemo(
    () => leads.filter((l) => matchesSegmentTab(l, segmentTab)),
    [leads, segmentTab],
  );

  const filtered = useMemo(
    () =>
      segmentLeads.filter((l) => {
        if (l.score < filters.minScore) return false;
        if (!matchesQuickFilter(l, filters.quickFilter)) return false;
        if (filters.signalType !== 'all') {
          if (!l.signals.some((s) => s.type === filters.signalType)) return false;
        }
        if (filters.status !== 'all' && l.status !== filters.status) return false;
        if (filters.assignedTo === 'unassigned') {
          if (l.assignedTo != null) return false;
        } else if (filters.assignedTo !== 'all') {
          if (l.assignedTo !== filters.assignedTo) return false;
        }
        return true;
      }),
    [segmentLeads, filters],
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
        });
      } catch (e) {
        applyLeadPatch(id, previous);
        throw e;
      }
    },
    [applyLeadPatch, leads, supabase],
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

  const filterCount = countActiveFilters(filters, { countAssigned: isDirector });
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  return (
    <>
      <StatsBar leads={segmentLeads} />
      <TabsNav value={segmentTab} onTabChange={setSegmentTab} counts={tabCounts} />

      <ProspectQuickFilters
        value={filters.quickFilter}
        onChange={(quickFilter) => setFilters((prev) => ({ ...prev, quickFilter }))}
      />

      <div className="hidden md:block">
        <FiltersBar
          filters={filters}
          onFiltersChange={setFilters}
          teamMembers={teamMembers}
          availableSignals={availableSignals}
          showAssignedFilter={isDirector}
        />
      </div>

      <ProspectsListToolbar
        count={filtered.length}
        viewMode={prospectsView}
        onViewModeChange={(v) => {
          setProspectsView(v);
          if (v === 'carte') setSelectedLeadId(null);
        }}
        onExportCsv={isDirector ? () => exportLeadsToCsv(filtered) : undefined}
        filterActiveCount={filterCount}
        onOpenFilters={() => setFiltersSheetOpen(true)}
        showExportCsv={isDirector}
      />

      <ProspectsFiltersSheet
        open={filtersSheetOpen}
        onClose={() => setFiltersSheetOpen(false)}
        appliedFilters={filters}
        onApply={setFilters}
        teamMembers={teamMembers}
        availableSignals={availableSignals}
        showAssignedFilter={isDirector}
      />

      {prospectsView === 'liste' ? (
        <LeadsList
          leads={filtered}
          segmentTab={segmentTab}
          hasAnyLead={leads.length > 0}
          onLeadClick={setSelectedLeadId}
          onStatusChange={onStatusInline}
          onResetFilters={resetFilters}
        />
      ) : (
        <MapViewPlaceholder />
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
    </>
  );
}
