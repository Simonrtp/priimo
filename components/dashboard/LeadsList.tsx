'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Lead, LeadSegmentTab } from '@/types/lead';
import type { DeliveryBatchGroup } from '@/lib/lead-delivery';
import LeadCard from './LeadCard';
import EmptyState from './EmptyState';

interface LeadsListProps {
  newBatch: Lead[];
  previousTotal: number;
  previousGroups: DeliveryBatchGroup[];
  segmentTab: LeadSegmentTab;
  hasAnyLead: boolean;
  onLeadClick: (id: string) => void;
  onStatusChange: (id: string, status: Lead['status']) => void;
  onResetFilters?: () => void;
}

function PreviousLeadsSection({
  total,
  groups,
  segmentTab,
  indexOffset,
  onLeadClick,
  onStatusChange,
}: {
  total: number;
  groups: DeliveryBatchGroup[];
  segmentTab: LeadSegmentTab;
  indexOffset: number;
  onLeadClick: (id: string) => void;
  onStatusChange: (id: string, status: Lead['status']) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (total === 0) return null;

  let runningIndex = indexOffset;

  return (
    <div className="border-t border-black/[0.08]">
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.02] md:px-5"
      >
        <span className="min-w-0 flex-1 font-semibold text-mute" style={{ fontSize: 13 }}>
          Leads précédents ({total})
        </span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-mute transition-transform duration-150 ease-out ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      <div id={panelId} hidden={!open}>
        {groups.map((group, groupIdx) => (
          <div key={group.deliveredAt}>
            <p
              className="border-t border-black/[0.05] bg-black/[0.02] px-4 py-2 uppercase tracking-widest text-mute md:px-5"
              style={{ fontSize: 9, letterSpacing: '0.14em' }}
            >
              {group.label}
            </p>
            {group.leads.map((lead, leadIdx) => {
              const cardIndex = runningIndex;
              runningIndex += 1;
              const isLastGroup = groupIdx === groups.length - 1;
              const isLastLead = leadIdx === group.leads.length - 1;
              return (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  index={cardIndex}
                  isLast={isLastGroup && isLastLead}
                  segmentTab={segmentTab}
                  onClick={() => onLeadClick(lead.id)}
                  onStatusChange={(s) => onStatusChange(lead.id, s)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeadsList({
  newBatch,
  previousTotal,
  previousGroups,
  segmentTab,
  hasAnyLead,
  onLeadClick,
  onStatusChange,
  onResetFilters,
}: LeadsListProps) {
  const totalVisible = newBatch.length + previousTotal;

  if (totalVisible === 0) {
    return (
      <EmptyState
        variant={hasAnyLead ? 'no-filtered-results' : 'no-leads'}
        onResetFilters={hasAnyLead ? onResetFilters : undefined}
      />
    );
  }

  const hasPrevious = previousTotal > 0;

  return (
    <div
      id="prospects-leads-list"
      className="flex flex-col gap-2 max-md:bg-transparent md:gap-0 md:overflow-visible md:rounded-2xl md:border md:border-black/8 md:bg-white md:shadow-soft"
    >
      {newBatch.map((lead, i) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          index={i}
          isLast={!hasPrevious && i === newBatch.length - 1}
          segmentTab={segmentTab}
          showNewBadge
          onClick={() => onLeadClick(lead.id)}
          onStatusChange={(s) => onStatusChange(lead.id, s)}
        />
      ))}

      <PreviousLeadsSection
        total={previousTotal}
        groups={previousGroups}
        segmentTab={segmentTab}
        indexOffset={newBatch.length}
        onLeadClick={onLeadClick}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}
