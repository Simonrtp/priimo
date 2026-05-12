'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mockLeads } from '@/lib/mock-data';
import { mockUserIsPremium } from '@/lib/mock-user';
import type { Lead, Filters, LeadSegmentTab } from '@/types/lead';
import StatsBar from '@/components/dashboard/StatsBar';
import SegmentTabs from '@/components/dashboard/SegmentTabs';
import FiltersBar from '@/components/dashboard/FiltersBar';
import LeadsList from '@/components/dashboard/LeadsList';
import ExportActions from '@/components/dashboard/ExportActions';
import LeadDrawer from '@/components/dashboard/LeadDrawer';
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ minScore: 0, signalType: 'all', status: 'all' });
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);

  const rawTab = searchParams.get('tab');
  const segmentTab: LeadSegmentTab =
    rawTab === 'entreprises' || rawTab === 'particuliers' || rawTab === 'tous' ? rawTab : 'tous';

  const enterpriseViewLocked = !mockUserIsPremium && segmentTab === 'entreprises';

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
        if (filters.signalType === 'liquidation_pro') { if (!l.lifeEvent) return false; }
        else if (!l.signalType.includes(filters.signalType)) return false;
      }
      if (filters.status !== 'all' && l.status !== filters.status) return false;
      return true;
    });
  }, [leads, segmentTab, filters, enterpriseViewLocked]);

  const selected = selectedId ? leads.find((l) => l.id === selectedId) ?? null : null;

  const updateStatus = (id: string, status: Lead['status']) =>
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));

  const updateLead = (updated: Lead) =>
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));

  const onTabAttempt = (t: LeadSegmentTab) => {
    if (t === 'entreprises' && !mockUserIsPremium) {
      setPremiumModalOpen(true);
      router.replace('/dashboard?tab=entreprises', { scroll: false });
      return;
    }
    if (t === 'tous') router.replace('/dashboard', { scroll: false });
    else router.replace(`/dashboard?tab=${t}`, { scroll: false });
  };

  return (
    <>
      <StatsBar leads={enterpriseViewLocked ? leads : filtered} />
      <SegmentTabs
        value={segmentTab}
        onTabAttempt={onTabAttempt}
        counts={tabCounts}
        isPremium={mockUserIsPremium}
      />
      <FiltersBar filters={filters} onFiltersChange={setFilters} />

      <p
        className="uppercase text-mute tracking-widest mb-3"
        style={{ fontSize: 9, letterSpacing: '0.15em' }}
      >
        {filtered.length} prospect{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
      </p>

      <LeadsList
        leads={filtered}
        segmentTab={segmentTab}
        isPlanPremium={mockUserIsPremium}
        enterpriseViewLocked={enterpriseViewLocked}
        onLeadClick={setSelectedId}
        onStatusChange={updateStatus}
      />
      <ExportActions leads={filtered} />
      <LeadDrawer
        lead={selected}
        isPlanPremium={mockUserIsPremium}
        onClose={() => setSelectedId(null)}
        onUpdateLead={updateLead}
      />
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
