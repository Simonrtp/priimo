'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Filters, Lead, LeadSegmentTab } from '@/types/lead';
import type { DeliveryBatchGroup } from '@/lib/lead-delivery';
import { matchesLeadFilters } from '@/lib/lead-filters';
import { sortProspects } from '@/lib/lead-dpe';
import LeadCard from './LeadCard';
import EmptyState from './EmptyState';

interface LeadsListProps {
  newBatch: Lead[];
  previousGroups: DeliveryBatchGroup[];
  filters: Filters;
  segmentTab: LeadSegmentTab;
  hasAnyLead: boolean;
  onLeadClick: (id: string) => void;
  onStatusChange: (id: string, status: Lead['status']) => void;
  onResetFilters?: () => void;
}

function PreviousLeadsSection({
  groups,
  segmentTab,
  indexOffset,
  onLeadClick,
  onStatusChange,
}: {
  groups: DeliveryBatchGroup[];
  segmentTab: LeadSegmentTab;
  indexOffset: number;
  onLeadClick: (id: string) => void;
  onStatusChange: (id: string, status: Lead['status']) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const total = groups.reduce((n, g) => n + g.leads.length, 0);
  if (total === 0) return null;

  let runningIndex = indexOffset;

  return (
    <div className="md:col-span-2 max-lg:rounded-xl max-lg:border max-lg:border-black/8 max-lg:bg-white max-lg:shadow-soft lg:col-span-1 lg:rounded-none lg:border-0 lg:border-t lg:border-black/[0.08] lg:bg-transparent lg:shadow-none">
      <button
        type="button"
        id={`${panelId}-trigger`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.02] sm:px-4 md:px-5"
      >
        <span className="min-w-0 flex-1 font-semibold leading-snug text-mute" style={{ fontSize: 13 }}>
          Leads précédents ({total})
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-mute transition-transform duration-150 ease-out ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={panelId}
          className="md:grid md:grid-cols-2 md:gap-3 md:px-3 md:pb-3 lg:block lg:px-0 lg:pb-0"
        >
          {groups.map((group, groupIdx) => (
            <div key={group.deliveredAt} className="contents lg:block">
              <p
                className="col-span-2 border-t border-black/[0.05] bg-black/[0.02] px-4 py-2 uppercase tracking-widest text-mute max-lg:rounded-lg max-lg:border-0 max-lg:bg-transparent md:px-1 lg:rounded-none lg:border-t lg:bg-black/[0.02] lg:px-5"
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
      )}
    </div>
  );
}

export default function LeadsList({
  newBatch,
  previousGroups,
  filters,
  segmentTab,
  hasAnyLead,
  onLeadClick,
  onStatusChange,
  onResetFilters,
}: LeadsListProps) {
  const visibleNewBatch = useMemo(
    () =>
      sortProspects(
        newBatch.filter((lead) => matchesLeadFilters(lead, filters)),
        filters.sortBy,
      ),
    [newBatch, filters],
  );

  const visiblePreviousGroups = useMemo(() => {
    return previousGroups
      .map((group) => ({
        ...group,
        leads: sortProspects(
          group.leads.filter((lead) => matchesLeadFilters(lead, filters)),
          filters.sortBy,
        ),
      }))
      .filter((group) => group.leads.length > 0);
  }, [previousGroups, filters]);

  const previousTotal = visiblePreviousGroups.reduce((n, g) => n + g.leads.length, 0);
  const totalVisible = visibleNewBatch.length + previousTotal;

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
      data-tour="leads-list"
      className="flex w-full min-w-0 flex-col gap-2 md:grid md:grid-cols-2 md:gap-3 lg:flex lg:flex-col lg:gap-0 lg:overflow-visible lg:rounded-clay-lg lg:bg-surface lg:shadow-clay"
    >
      {visibleNewBatch.map((lead, i) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          index={i}
          isLast={!hasPrevious && i === visibleNewBatch.length - 1}
          segmentTab={segmentTab}
          showNewBadge
          onClick={() => onLeadClick(lead.id)}
          onStatusChange={(s) => onStatusChange(lead.id, s)}
        />
      ))}

      <PreviousLeadsSection
        groups={visiblePreviousGroups}
        segmentTab={segmentTab}
        indexOffset={visibleNewBatch.length}
        onLeadClick={onLeadClick}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}
