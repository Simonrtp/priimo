'use client';

import { isSciDirectorPending, type Lead, type LeadSegmentTab } from '@/types/lead';
import ScoreRing from './ScoreRing';
import ScoreHeatBadge from './ScoreHeatBadge';
import StatusBadge from './StatusBadge';
import DetentionLabel from './DetentionLabel';
import LeadSignalList from './LeadSignalList';
import { formatPrice } from '@/lib/utils';
import { ICONS, ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';

interface LeadCardProps {
  lead: Lead;
  index: number;
  isLast: boolean;
  segmentTab: LeadSegmentTab;
  onClick: () => void;
  onStatusChange: (status: Lead['status']) => void;
}

function SegmentRowIcon({ tab, ownerType }: { tab: LeadSegmentTab; ownerType: Lead['ownerType'] }) {
  if (tab === 'particuliers') return null;
  if (tab === 'tous' && ownerType === 'entreprise') {
    return (
      <ICONS.building
        className="flex-shrink-0"
        size={ICON_SIZE.sm}
        color={ICON_COLORS.muted500}
        strokeWidth={2}
        aria-hidden
      />
    );
  }
  if (tab === 'tous') {
    return (
      <ICONS.user
        className="flex-shrink-0"
        size={ICON_SIZE.sm}
        color={ICON_COLORS.muted500}
        strokeWidth={2}
        aria-hidden
      />
    );
  }
  return (
    <ICONS.building
      className="flex-shrink-0"
      size={ICON_SIZE.sm}
      color={ICON_COLORS.muted500}
      strokeWidth={2}
      aria-hidden
    />
  );
}

export default function LeadCard({
  lead,
  index,
  isLast,
  segmentTab,
  onClick,
  onStatusChange,
}: LeadCardProps) {
  const isHighIntent = lead.score >= 80 && lead.signals.length > 0;
  const propertyType = lead.propertyType ?? 'Bien';
  const surface = lead.surfaceM2 != null ? `${lead.surfaceM2} m²` : null;
  const acquiredPriceLabel =
    lead.acquiredPrice != null ? `${formatPrice(lead.acquiredPrice)} €` : null;
  const hasDetention = lead.acquiredYear != null;

  return (
    <div
      data-lead-card
      onClick={onClick}
      className={`relative cursor-pointer transition-colors duration-150 animate-lead-reveal hover:bg-black/[0.018] max-md:rounded-xl max-md:border max-md:border-black/8 max-md:bg-white max-md:px-3 max-md:py-3 max-md:shadow-soft md:hover:bg-black/[0.018] lg:flex lg:items-center lg:gap-4 lg:px-5 lg:py-[18px] lg:shadow-none ${
        !isLast ? 'border-b border-black/[0.05] max-md:border-b-0' : ''
      }`}
      style={{ animationDelay: `${index * 38}ms` }}
    >
      {isHighIntent && (
        <span className="absolute left-0 top-4 bottom-4 hidden w-[3px] bg-accent rounded-r-[2px] lg:block" />
      )}

      <div className="flex items-start gap-3 lg:hidden">
        <div className="flex flex-shrink-0 flex-col items-center gap-1">
          <ScoreRing score={lead.score} size={36} />
          <ScoreHeatBadge score={lead.score} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="truncate font-semibold text-ink" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
              {lead.address}
            </span>
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <StatusBadge status={lead.status} onChange={onStatusChange} />
            </div>
          </div>
          {hasDetention && (
            <div className="mt-1">
              <DetentionLabel acquiredYear={lead.acquiredYear} variant="stacked" />
            </div>
          )}
          <div className="mt-2">
            <LeadSignalList signals={lead.signals} variant="summary" />
          </div>
          <p className="mt-1.5 truncate text-mute" style={{ fontSize: 12 }}>
            {propertyType}
            {surface && (
              <>
                <span className="mx-1.5 opacity-40">·</span>
                {surface}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="hidden w-full items-center gap-4 lg:flex">
        <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
          <ScoreRing score={lead.score} size={44} />
          <ScoreHeatBadge score={lead.score} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-start gap-2">
            <SegmentRowIcon tab={segmentTab} ownerType={lead.ownerType} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="truncate font-semibold text-ink"
                  style={{ fontSize: 14, letterSpacing: '-0.01em' }}
                >
                  {lead.address}
                </span>
              </div>
              {lead.companyName && (
                <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-y-0.5 font-medium text-[#374151]" style={{ fontSize: 12 }}>
                  <span className="truncate">
                    {lead.companyName}
                    {lead.companyDirector ? ` — ${lead.companyDirector}` : ''}
                  </span>
                  {isSciDirectorPending(lead) && (
                    <span className="ml-2 inline-flex shrink-0 items-center rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0 text-[10px] font-normal text-orange-700">
                      Contacts bientôt
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          {hasDetention && (
            <div className="mb-1.5">
              <DetentionLabel acquiredYear={lead.acquiredYear} variant="inline" />
            </div>
          )}
          <LeadSignalList signals={lead.signals} variant="summary" />
          <p className="mt-1 min-w-0 truncate text-mute" style={{ fontSize: 12 }}>
            {propertyType}
            {surface && (
              <>
                <span className="mx-1.5 opacity-40">·</span>
                {surface}
              </>
            )}
          </p>
        </div>
        {acquiredPriceLabel && (
          <div className="hidden w-[120px] flex-shrink-0 text-right lg:block">
            <p className="font-medium tabular text-ink" style={{ fontSize: 12.5 }}>
              {acquiredPriceLabel}
            </p>
          </div>
        )}
        <div className="hidden flex-shrink-0 lg:block" onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={lead.status} onChange={onStatusChange} />
        </div>
      </div>
    </div>
  );
}
