'use client';

import { memo } from 'react';
import { ChevronRight, Phone, ShieldCheck } from 'lucide-react';
import { isSciDirectorPending, type Lead, type LeadSegmentTab } from '@/types/lead';
import ScoreRing from './ScoreRing';
import StatusBadge from './StatusBadge';
import LeadSignalList from './LeadSignalList';
import { formatPrice } from '@/lib/utils';
import { formatEtage } from '@/lib/lead-display';
import { hasAnyLeadPhone } from '@/lib/lead-contacts';
import { hasDisplayableAcquiredPrice } from '@/lib/lead-valorisation';
import { ICONS, ICON_COLORS, ICON_SIZE } from '@/lib/iconMapping';

const SLATE = '#3D5A80';

function PropertyMetaLine({
  segments,
  className,
}: {
  segments: string[];
  className?: string;
}) {
  if (segments.length === 0) return null;
  return (
    <p className={`min-w-0 truncate text-mute ${className ?? ''}`} style={{ fontSize: 13 }}>
      {segments.map((seg, i) => (
        <span key={`${seg}-${i}`}>
          {i > 0 && <span className="mx-1.5 opacity-40">·</span>}
          {seg}
        </span>
      ))}
    </p>
  );
}

/** Icônes à côté de l’adresse : téléphone + hors portails. */
function AddressSignalIcons({
  showPhone,
  horsMarche,
}: {
  showPhone: boolean;
  horsMarche: boolean;
}) {
  if (!showPhone && !horsMarche) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 self-center"
      aria-label="Signaux contact et marché"
    >
      {showPhone && (
        <Phone
          size={14}
          strokeWidth={2.2}
          className="shrink-0"
          style={{ color: SLATE }}
          aria-label="Téléphone disponible"
        />
      )}
      {horsMarche && (
        <ShieldCheck
          size={14}
          strokeWidth={2.2}
          className="shrink-0"
          style={{ color: SLATE }}
          aria-label="Absent des portails de vente"
        />
      )}
    </span>
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

function LeadCard({
  lead,
  index,
  isLast,
  segmentTab,
  showNewBadge: _showNewBadge = false,
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
  const showPhone = hasAnyLeadPhone(lead);
  const horsMarche = lead.marcheStatut === 'hors_marche' && Boolean(lead.marcheVerifieLe);

  return (
    <div
      data-lead-card
      data-lead-id={lead.id}
      data-tour={index === 0 ? 'lead-card' : undefined}
      onClick={onClick}
      className={`relative h-full cursor-pointer transition-colors duration-150 animate-lead-reveal hover:bg-black/[0.018] max-lg:rounded-2xl max-lg:border max-lg:border-black/[0.06] max-lg:bg-surface max-lg:px-4 max-lg:py-5 max-lg:shadow-clay-sm max-md:active:scale-[0.985] max-md:active:bg-black/[0.01] lg:flex lg:h-auto lg:items-center lg:gap-5 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-6 lg:py-6 lg:shadow-none [content-visibility:auto] [contain-intrinsic-size:auto_140px] ${
        !isLast ? 'lg:border-b lg:border-black/[0.05]' : ''
      }`}
      style={{ animationDelay: `${Math.min(index, 24) * 38}ms`, WebkitTapHighlightColor: 'transparent' }}
    >
      {isHighIntent && (
        <span className="absolute left-0 top-4 bottom-4 hidden w-[3px] rounded-r-[2px] bg-accent-dark lg:block" />
      )}

      {/* Mobile + tablette : carte verticale */}
      <div className="flex h-full items-start gap-3.5 lg:hidden">
        <div
          className="flex shrink-0 flex-col items-center pt-0.5"
          data-tour={index === 0 ? 'lead-score-mobile' : undefined}
        >
          <ScoreRing score={lead.score} size={40} />
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
            className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-pretty font-semibold leading-snug text-ink"
            style={{ fontSize: 15, letterSpacing: '-0.01em' }}
          >
            <span className="min-w-0">{lead.address}</span>
            <AddressSignalIcons showPhone={showPhone} horsMarche={horsMarche} />
          </p>

          <PropertyMetaLine segments={propertySegments} className="mt-1.5" />

          {lead.companyName && (
            <p
              className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-[#374151]"
              style={{ fontSize: 13 }}
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

          {acquiredPriceLabel && (
            <p className="mt-2 font-medium tabular text-ink" style={{ fontSize: 13 }}>
              {acquiredPriceLabel}
            </p>
          )}

          <div className="mt-2">
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

      {/* Desktop large : ligne horizontale */}
      <div className="hidden w-full items-center gap-5 lg:flex">
        <div
          className="flex flex-shrink-0 flex-col items-center"
          data-tour={index === 0 ? 'lead-score' : undefined}
        >
          <ScoreRing score={lead.score} size={48} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start gap-2.5">
            <SegmentRowIcon tab={segmentTab} ownerType={lead.ownerType} />
            <div className="min-w-0 flex-1">
              <p
                className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-pretty font-semibold leading-snug text-ink"
                style={{ fontSize: 15, letterSpacing: '-0.01em' }}
              >
                <span className="min-w-0">{lead.address}</span>
                <AddressSignalIcons showPhone={showPhone} horsMarche={horsMarche} />
              </p>
              {lead.companyName && (
                <p className="mt-1 flex min-w-0 flex-wrap items-center gap-y-0.5 font-medium text-[#374151]" style={{ fontSize: 13 }}>
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
          {acquiredPriceLabel && (
            <p className="mb-2 font-medium tabular text-ink" style={{ fontSize: 13 }}>
              {acquiredPriceLabel}
            </p>
          )}
          <LeadSignalList signals={lead.signals} variant="summary" />
          <PropertyMetaLine segments={propertySegments} className="mt-1.5 min-w-0" />
        </div>
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

export default memo(LeadCard);
