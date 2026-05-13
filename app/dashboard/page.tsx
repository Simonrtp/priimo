'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mockLeads, mockAgents, MOCK_ZONES } from '@/lib/mock-data';
import { mockUserIsPremium } from '@/lib/mock-user';
import type { Lead, Filters, LeadSegmentTab } from '@/types/lead';
import { leadHasEvenementSociete } from '@/types/lead';
import StatsBar from '@/components/dashboard/StatsBar';
import TabsNav from '@/components/dashboard/TabsNav';
import FiltersBar, { countActiveFilters } from '@/components/dashboard/FiltersBar';
import ProspectsListToolbar, { type ProspectsViewMode } from '@/components/dashboard/ProspectsListToolbar';
import ProspectsFiltersSheet from '@/components/dashboard/ProspectsFiltersSheet';
import MapViewPlaceholder from '@/components/dashboard/MapViewPlaceholder';
import LeadsList from '@/components/dashboard/LeadsList';
import LeadDrawer from '@/components/dashboard/LeadDrawer';
import LeadFullScreenMobile from '@/components/dashboard/LeadFullScreenMobile';
import PremiumEnterpriseModal from '@/components/dashboard/PremiumEnterpriseModal';

function matchesSegmentTab(lead: Lead, tab: LeadSegmentTab): boolean {
  if (tab === 'tous') return true;
  if (tab === 'entreprises') return lead.segment === 'entreprise';
  return lead.segment === 'particulier';
}

function ProspectsBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    minScore: 0,
    signalType: 'all',
    status: 'all',
    assignedTo: 'all',
    zoneId: 'all',
  });
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [prospectsView, setProspectsView] = useState<ProspectsViewMode>('liste');
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

  const rawTab = searchParams.get('tab');
  const segmentTab: LeadSegmentTab =
    rawTab === 'entreprises' || rawTab === 'particuliers' || rawTab === 'tous' ? rawTab : 'tous';

  const enterpriseViewLocked = !mockUserIsPremium && segmentTab === 'entreprises';

  useEffect(() => {
    setFilters((f) => ({ ...f, signalType: 'all' }));
  }, [segmentTab]);

  const tabCounts = useMemo(() => {
    const tous = leads.length;
    const entreprises = leads.filter((l) => l.segment === 'entreprise').length;
    const particuliers = leads.filter((l) => l.segment === 'particulier').length;
    return { tous, entreprises, particuliers };
  }, [leads]);

  const filtered = useMemo(() => {
    if (enterpriseViewLocked) return [];
    return leads.filter((l) => {
      if (!matchesSegmentTab(l, segmentTab)) return false;
      if (l.score < filters.minScore) return false;
      if (filters.signalType !== 'all') {
        if (filters.signalType === 'evenement_societe') {
          if (!leadHasEvenementSociete(l)) return false;
        } else if (!l.signalType.includes(filters.signalType)) return false;
      }
      if (filters.status !== 'all' && l.status !== filters.status) return false;
      if (filters.assignedTo === 'unassigned') {
        if (l.assignedAgentId != null) return false;
      } else if (filters.assignedTo !== 'all') {
        if (l.assignedAgentId !== filters.assignedTo) return false;
      }
      if (filters.zoneId !== 'all' && l.zoneId !== filters.zoneId) return false;
      return true;
    });
  }, [leads, segmentTab, filters, enterpriseViewLocked]);

  const selected = selectedLeadId ? leads.find((l) => l.id === selectedLeadId) ?? null : null;

  const updateStatus = (id: string, status: Lead['status']) =>
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));

  const updateLead = (updated: Lead) =>
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));

  const handleProspectsViewChange = (v: ProspectsViewMode) => {
    setProspectsView(v);
    if (v === 'carte') setSelectedLeadId(null);
  };

  const onTabAttempt = (t: LeadSegmentTab) => {
    if (t === 'entreprises' && !mockUserIsPremium) {
      setPremiumModalOpen(true);
      router.replace('/dashboard?tab=entreprises', { scroll: false });
      return;
    }
    if (t === 'tous') router.replace('/dashboard', { scroll: false });
    else router.replace(`/dashboard?tab=${t}`, { scroll: false });
  };

  const filterCount = countActiveFilters(filters);

  return (
    <>
      <StatsBar leads={enterpriseViewLocked ? leads : filtered} />
      <TabsNav
        value={segmentTab}
        onTabAttempt={onTabAttempt}
        counts={tabCounts}
        isPremium={mockUserIsPremium}
      />
      <div className="hidden md:block">
        <FiltersBar
          segmentTab={segmentTab}
          filters={filters}
          onFiltersChange={setFilters}
          agents={mockAgents}
          zones={MOCK_ZONES}
        />
      </div>

      <ProspectsListToolbar
        count={filtered.length}
        viewMode={prospectsView}
        onViewModeChange={handleProspectsViewChange}
        onExportCsv={() => console.log('Export CSV', filtered)}
        filterActiveCount={filterCount}
        onOpenFilters={() => setFiltersSheetOpen(true)}
      />

      <ProspectsFiltersSheet
        open={filtersSheetOpen}
        onClose={() => setFiltersSheetOpen(false)}
        segmentTab={segmentTab}
        appliedFilters={filters}
        onApply={setFilters}
        agents={mockAgents}
        zones={MOCK_ZONES}
      />

      {prospectsView === 'liste' ? (
        <LeadsList
          leads={filtered}
          segmentTab={segmentTab}
          isPlanPremium={mockUserIsPremium}
          enterpriseViewLocked={enterpriseViewLocked}
          onLeadClick={setSelectedLeadId}
          onStatusChange={updateStatus}
        />
      ) : (
        <MapViewPlaceholder />
      )}
      <LeadDrawer
        lead={selected}
        isPlanPremium={mockUserIsPremium}
        onClose={() => setSelectedLeadId(null)}
        onUpdateLead={updateLead}
      />
      {selected && (
        <LeadFullScreenMobile
          lead={selected}
          isPlanPremium={mockUserIsPremium}
          onClose={() => setSelectedLeadId(null)}
          onUpdateLead={updateLead}
        />
      )}
      <PremiumEnterpriseModal open={premiumModalOpen} onClose={() => setPremiumModalOpen(false)} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={(
        <div
          className="min-h-[280px] rounded-2xl bg-white border border-black/8 shadow-soft animate-pulse"
          aria-hidden
        />
      )}
    >
      <ProspectsBody />
    </Suspense>
  );
}
