'use client';

import { ChevronRight } from 'lucide-react';
import { isSciDirectorPending, type Lead, type LeadSegmentTab } from '@/types/lead';
import ScoreRing from './ScoreRing';
import StatusBadge from './StatusBadge';
import DetentionLabel from './DetentionLabel';
import LeadSignalList from './LeadSignalList';
import LeadSourceBadges from './LeadSourceBadges';
import { formatPrice } from '@/lib/utils';
import { formatEtage } from '@/lib/lead-display';
import { hasDisplayableAcquiredPrice } from '@/lib/lead-valorisation';
import { ICONS, ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';

function PropertyMetaLine({ segments, className }: { segments: string[]; className?: string }) {
  if (segments.length === 0) return null;
  return (
    <p className={`text-mute ${className ?? ''}`} style={{ fontSize: 12 }}>
      {segments.map((seg, i) => (
        <span key={`${seg}-${i}`}>
          {i > 0 && <span className="mx-1.5 opacity-40">·</span>}
          {seg}
        </span>
      ))}
    </p>
  );
}

interface LeadCardProps {
  lead: Lead;
  index: number;
  isLast: boolean;
  segmentTab: LeadSegmentTab;
  showNewBadge?: boolean;
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
  showNewBadge = false,
  onClick,
  onStatusChange,
}: LeadCardProps) {
  const isHighIntent = lead.score >= 80 && lead.signals.length > 0;
  const surface = lead.surfaceM2 != null ? `${lead.surfaceM2} m²` : null;
  const propertySegments = [
    lead.propertyType,
    surface,
    formatEtage(lead.etage, lead.propertyType),
  ].filter((s): s is string => Boolean(s));
  const acquiredPriceLabel =
    hasDisplayableAcquiredPrice(lead) && lead.acquiredPrice != null
      ? `${formatPrice(lead.acquiredPrice)} €`
      : null;
  const hasDetention = lead.acquiredYear != null;

  return (
    <div
      data-lead-card
      data-lead-id={lead.id}
      data-tour={index === 0 ? 'lead-card' : undefined}
      onClick={onClick}
      className={`relative cursor-pointer transition-colors duration-150 animate-lead-reveal hover:bg-black/[0.018] max-md:rounded-2xl max-md:bg-surface max-md:px-3.5 max-md:py-3.5 max-md:shadow-clay-sm max-md:transition max-md:duration-150 max-md:active:scale-[0.985] max-md:active:bg-black/[0.01] md:hover:bg-black/[0.018] lg:flex lg:items-center lg:gap-4 lg:px-5 lg:py-[18px] lg:shadow-none ${
        !isLast ? 'border-b border-black/[0.05] max-md:border-b-0' : ''
      }`}
      style={{ animationDelay: `${index * 38}ms`, WebkitTapHighlightColor: 'transparent' }}
    >
      {isHighIntent && (
        <span className="absolute left-0 top-4 bottom-4 hidden w-[3px] bg-accent-dark rounded-r-[2px] lg:block" />
      )}

      <div className="flex items-start gap-3 lg:hidden">
        <div
          className="flex shrink-0 flex-col items-center pt-0.5"
          data-tour={index === 0 ? 'lead-score-mobile' : undefined}
        >
          <ScoreRing score={lead.score} size={36} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            onClick={(e) => e.stopPropagation()}
            className="inline-block"
            data-tour={index === 0 ? 'lead-feedback-mobile' : undefined}
          >
            <StatusBadge status={lead.status} onChange={onStatusChange} />
          </div>

          <p
            className="mt-2 text-pretty font-semibold leading-snug text-ink"
            style={{ fontSize: 14, letterSpacing: '-0.01em' }}
          >
            {lead.address}
          </p>

          <PropertyMetaLine segments={propertySegments} className="mt-1" />

          {lead.companyName && (
            <p
              className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-[#374151]"
              style={{ fontSize: 12 }}
            >
              <span className="line-clamp-1 min-w-0">
                {lead.companyName}
                {lead.companyDirector ? ` — ${lead.companyDirector}` : ''}
              </span>
              {isSciDirectorPending(lead) && (
                <span className="inline-flex shrink-0 items-center rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0 text-[10px] font-normal text-orange-700">
                  Contacts bientôt
                </span>
              )}
            </p>
          )}

          <LeadSourceBadges lead={lead} className="mt-1.5" />

          {hasDetention && (
            <div className="mt-1.5">
              <DetentionLabel acquiredYear={lead.acquiredYear} variant="stacked" />
            </div>
          )}

          <div className="mt-1.5">
            <LeadSignalList signals={lead.signals} variant="summary" />
          </div>
        </div>
        <ChevronRight
          size={18}
          strokeWidth={2}
          className="mt-0.5 shrink-0 self-center text-text-subtle"
          aria-hidden
        />
      </div>

      <div className="hidden w-full items-center gap-4 lg:flex">
        <div
          className="flex flex-shrink-0 flex-col items-center"
          data-tour={index === 0 ? 'lead-score' : undefined}
        >
          <ScoreRing score={lead.score} size={44} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-start gap-2">
            <SegmentRowIcon tab={segmentTab} ownerType={lead.ownerType} />
            <div className="min-w-0 flex-1">
              <p
                className="text-pretty font-semibold leading-snug text-ink"
                style={{ fontSize: 14, letterSpacing: '-0.01em' }}
              >
                {lead.address}
              </p>
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
              <LeadSourceBadges lead={lead} className="mt-1" />
            </div>
          </div>
          {hasDetention && (
            <div className="mb-1.5">
              <DetentionLabel acquiredYear={lead.acquiredYear} variant="inline" />
            </div>
          )}
          <LeadSignalList signals={lead.signals} variant="summary" />
          <PropertyMetaLine segments={propertySegments} className="mt-1 min-w-0 truncate" />
        </div>
        {acquiredPriceLabel && (
          <div className="hidden w-[120px] flex-shrink-0 text-right lg:block">
            <p className="font-medium tabular text-ink" style={{ fontSize: 12.5 }}>
              {acquiredPriceLabel}
            </p>
          </div>
        )}
        <div
          className="hidden flex-shrink-0 lg:block"
          onClick={(e) => e.stopPropagation()}
          data-tour={index === 0 ? 'lead-feedback' : undefined}
        >
          <StatusBadge status={lead.status} onChange={onStatusChange} />
        </div>
      </div>
    </div>
  );
}
