'use client';

import { useState, useMemo } from 'react';
import { mockLeads } from '@/lib/mock-data';
import type { Lead, Filters } from '@/types/lead';
import StatsBar from '@/components/dashboard/StatsBar';
import FiltersBar from '@/components/dashboard/FiltersBar';
import LeadsList from '@/components/dashboard/LeadsList';
import ExportActions from '@/components/dashboard/ExportActions';
import LeadDrawer from '@/components/dashboard/LeadDrawer';

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    minScore: 0,
    signalType: 'all',
    status: 'all',
  });

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (lead.score < filters.minScore) return false;
      if (filters.signalType !== 'all') {
        // 'liquidation_pro' maps to "Événement de vie" — filter on any life event
        if (filters.signalType === 'liquidation_pro') {
          if (!lead.lifeEvent) return false;
        } else {
          if (!lead.signalType.includes(filters.signalType)) return false;
        }
      }
      if (filters.status !== 'all' && lead.status !== filters.status) return false;
      return true;
    });
  }, [leads, filters]);

  const selectedLead = selectedLeadId
    ? leads.find((l) => l.id === selectedLeadId) ?? null
    : null;

  const handleStatusChange = (id: string, status: Lead['status']) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  const handleUpdateLead = (updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  return (
    <>
      <StatsBar leads={filteredLeads} />
      <FiltersBar filters={filters} onFiltersChange={setFilters} />
      <LeadsList
        leads={filteredLeads}
        onLeadClick={setSelectedLeadId}
        onStatusChange={handleStatusChange}
      />
      <ExportActions leads={filteredLeads} />
      <LeadDrawer
        lead={selectedLead}
        onClose={() => setSelectedLeadId(null)}
        onUpdateLead={handleUpdateLead}
      />
    </>
  );
}
