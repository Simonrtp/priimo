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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ minScore: 0, signalType: 'all', status: 'all' });

  const filtered = useMemo(() => leads.filter((l) => {
    if (l.score < filters.minScore) return false;
    if (filters.signalType !== 'all') {
      // 'liquidation_pro' = filtre "Événement de vie" → tout lead avec lifeEvent
      if (filters.signalType === 'liquidation_pro') { if (!l.lifeEvent) return false; }
      else { if (!l.signalType.includes(filters.signalType)) return false; }
    }
    if (filters.status !== 'all' && l.status !== filters.status) return false;
    return true;
  }), [leads, filters]);

  const selected = selectedId ? leads.find((l) => l.id === selectedId) ?? null : null;

  const updateStatus = (id: string, status: Lead['status']) =>
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));

  const updateLead = (updated: Lead) =>
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));

  return (
    <>
      <StatsBar leads={filtered} />
      <FiltersBar filters={filters} onFiltersChange={setFilters} />

      {/* Lead count */}
      <p
        className="uppercase text-mute tracking-widest mb-3"
        style={{ fontSize: 9, letterSpacing: '0.15em' }}
      >
        {filtered.length} prospect{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
      </p>

      <LeadsList
        leads={filtered}
        onLeadClick={setSelectedId}
        onStatusChange={updateStatus}
      />
      <ExportActions leads={filtered} />
      <LeadDrawer lead={selected} onClose={() => setSelectedId(null)} onUpdateLead={updateLead} />
    </>
  );
}
