'use client';

import type { Lead, LeadSegmentTab } from '@/types/lead';
import LeadCard from './LeadCard';
import EmptyState from './EmptyState';

interface LeadsListProps {
  leads: Lead[];
  segmentTab: LeadSegmentTab;
  hasAnyLead: boolean;
  onLeadClick: (id: string) => void;
  onStatusChange: (id: string, status: Lead['status']) => void;
  onResetFilters?: () => void;
}

export default function LeadsList({
  leads,
  segmentTab,
  hasAnyLead,
  onLeadClick,
  onStatusChange,
  onResetFilters,
}: LeadsListProps) {
  if (leads.length === 0) {
    return (
      <EmptyState
        variant={hasAnyLead ? 'no-filtered-results' : 'no-leads'}
        onResetFilters={hasAnyLead ? onResetFilters : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-hidden max-md:bg-transparent md:gap-0 md:rounded-2xl md:border md:border-black/8 md:bg-white md:shadow-soft">
      {leads.map((lead, i) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          index={i}
          isLast={i === leads.length - 1}
          segmentTab={segmentTab}
          onClick={() => onLeadClick(lead.id)}
          onStatusChange={(s) => onStatusChange(lead.id, s)}
        />
      ))}
    </div>
  );
}
