'use client';

import type { Lead, LeadSegmentTab } from '@/types/lead';
import LeadCard from './LeadCard';
import EmptyState from './EmptyState';

interface LeadsListProps {
  leads: Lead[];
  segmentTab: LeadSegmentTab;
  isPlanPremium: boolean;
  enterpriseViewLocked: boolean;
  onLeadClick: (id: string) => void;
  onStatusChange: (id: string, status: Lead['status']) => void;
}

export default function LeadsList({
  leads,
  segmentTab,
  isPlanPremium,
  enterpriseViewLocked,
  onLeadClick,
  onStatusChange,
}: LeadsListProps) {
  if (enterpriseViewLocked) {
    return (
      <div className="bg-white rounded-2xl shadow-soft border border-black/8 px-8 py-14 text-center">
        <p className="text-ink font-semibold mb-2" style={{ fontSize: 16 }}>
          Vue Entreprises réservée au Premium
        </p>
        <p className="text-mute max-w-md mx-auto mb-6" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Passez en Premium pour débloquer les coordonnées dirigeants SCI/SARL et accéder au filtre
          entreprises.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '10px 22px', fontSize: 14, borderRadius: 10 }}
        >
          Passer en Premium
        </button>
      </div>
    );
  }

  if (leads.length === 0) return <EmptyState />;

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-black/8 overflow-hidden">
      {leads.map((lead, i) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          index={i}
          isLast={i === leads.length - 1}
          segmentTab={segmentTab}
          isPlanPremium={isPlanPremium}
          onClick={() => onLeadClick(lead.id)}
          onStatusChange={(s) => onStatusChange(lead.id, s)}
        />
      ))}
    </div>
  );
}
