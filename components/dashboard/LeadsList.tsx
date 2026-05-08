'use client';

import type { Lead } from '@/types/lead';
import LeadCard from './LeadCard';
import EmptyState from './EmptyState';

interface LeadsListProps {
  leads: Lead[];
  onLeadClick: (id: string) => void;
  onStatusChange: (id: string, status: Lead['status']) => void;
}

export default function LeadsList({ leads, onLeadClick, onStatusChange }: LeadsListProps) {
  if (leads.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-2">
      {leads.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          onClick={() => onLeadClick(lead.id)}
          onStatusChange={(status) => onStatusChange(lead.id, status)}
        />
      ))}
    </div>
  );
}
