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
  if (leads.length === 0) return <EmptyState />;

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-black/8 overflow-hidden">
      {leads.map((lead, i) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          index={i}
          isLast={i === leads.length - 1}
          onClick={() => onLeadClick(lead.id)}
          onStatusChange={(s) => onStatusChange(lead.id, s)}
        />
      ))}
    </div>
  );
}
