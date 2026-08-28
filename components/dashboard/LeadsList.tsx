'use client';

import { Fragment, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Filters, Lead, LeadSegmentTab, LeadStage } from '@/types/lead';
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
  stages?: readonly LeadStage[];
  onTake?: (id: string) => void;
  onStageChange?: (id: string, stageId: string) => void;
  onResetFilters?: () => void;
}

function PreviousLeadsSection({
  groups,
  segmentTab,
  indexOffset,
  onLeadClick,
  onStatusChange,
  stages,
  onTake,
  onStageChange,
}: {
  groups: DeliveryBatchGroup[];
  segmentTab: LeadSegmentTab;
  indexOffset: number;
  onLeadClick: (id: string) => void;
  onStatusChange: (id: string, status: Lead['status']) => void;
  stages?: readonly LeadStage[];
  onTake?: (id: string) => void;
  onStageChange?: (id: string, stageId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const total = groups.reduce((n, g) => n + g.leads.length, 0);
  if (total === 0) return null;

  let runningIndex = indexOffset;

  // Les cartes dépliées sont des frères du bouton, pas ses enfants : sur mobile
  // et tablette elles gardent ainsi leur propre carte et l'écart de la grille,
  // au lieu d'être encastrées dans un second cadre.
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[48px] w-full items-center gap-2 text-left transition-[box-shadow,border-color] duration-fluid-subtle ease-in-out md:col-span-2 max-lg:rounded-2xl max-lg:border max-lg:border-black/[0.06] max-lg:bg-white max-lg:px-4 max-lg:py-3.5 max-lg:shadow-clay-sm max-lg:hover:border-black/[0.09] max-lg:hover:shadow-clay lg:bg-white lg:px-6 lg:py-4 lg:hover:shadow-[inset_0_0_0_9999px_rgba(10,13,17,0.018)]"
      >
        <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-mute">
          Leads précédents ({total})
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-mute transition-transform duration-fluid-subtle ease-in-out ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {open
        ? groups.map((group, groupIdx) => (
            <Fragment key={group.deliveredAt}>
              <p
                className="text-[9px] uppercase text-mute md:col-span-2 max-lg:px-1 max-lg:pt-1 lg:border-t lg:border-black/[0.05] lg:bg-bg-subtle lg:px-6 lg:py-2"
                style={{ letterSpacing: '0.14em' }}
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
                    stagger={false}
                    onClick={() => onLeadClick(lead.id)}
                    onStatusChange={(s) => onStatusChange(lead.id, s)}
                    stages={stages}
                    onTake={onTake ? () => onTake(lead.id) : undefined}
                    onStageChange={onStageChange ? (stageId) => onStageChange(lead.id, stageId) : undefined}
                  />
                );
              })}
            </Fragment>
          ))
        : null}
    </>
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
  stages,
  onTake,
  onStageChange,
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
      className="flex w-full min-w-0 flex-col gap-2 md:grid md:grid-cols-2 md:gap-3 lg:flex lg:flex-col lg:gap-0 lg:overflow-hidden lg:rounded-clay-lg lg:bg-white lg:shadow-clay"
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
          stages={stages}
          onTake={onTake ? () => onTake(lead.id) : undefined}
          onStageChange={onStageChange ? (stageId) => onStageChange(lead.id, stageId) : undefined}
        />
      ))}

      <PreviousLeadsSection
        groups={visiblePreviousGroups}
        segmentTab={segmentTab}
        indexOffset={visibleNewBatch.length}
        onLeadClick={onLeadClick}
        onStatusChange={onStatusChange}
        stages={stages}
        onTake={onTake}
        onStageChange={onStageChange}
      />
    </div>
  );
}
