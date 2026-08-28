'use client';

import { memo } from 'react';
import { ChevronRight, Phone, ShieldCheck } from 'lucide-react';
import { isSciDirectorPending, type Lead, type LeadSegmentTab, type LeadStage } from '@/types/lead';
import ScoreRing from './ScoreRing';
import StatusBadge from './StatusBadge';
import LeadStageBadge from './LeadStageBadge';
import FacadeLead from './FacadeLead';
import { formatPrice } from '@/lib/utils';
import { formatEtage, formatEtageForList, leadListAddressLine } from '@/lib/lead-display';
import { contactabiliteListLabel, hasDirectContactPhone } from '@/lib/lead-contacts';
import { hasDisplayableAcquiredPrice } from '@/lib/lead-valorisation';
import InfoTooltip from '@/components/ui/InfoTooltip';

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
    <p className={`min-w-0 truncate text-mute ${className ?? ''}`} style={{ fontSize: 14 }}>
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
  /** Cascade d'apparition. À couper quand des dizaines de cartes surgissent d'un coup. */
  stagger?: boolean;
  onClick: () => void;
  onStatusChange: (status: Lead['status']) => void;
  stages?: readonly LeadStage[];
  onTake?: () => void;
  onStageChange?: (stageId: string) => void;
}

function LeadCard({
  lead,
  index,
  isLast,
  segmentTab: _segmentTab,
  showNewBadge: _showNewBadge = false,
  stagger = true,
  onClick,
  onStatusChange,
  stages = [],
  onTake,
  onStageChange,
}: LeadCardProps) {
  const isHighIntent = lead.score >= 80 && lead.signals.length > 0;
  const surface = lead.surfaceM2 != null ? `${lead.surfaceM2} m²` : null;
  const propertySegments = [
    lead.propertyType,
    surface,
    formatEtage(lead.etage, lead.propertyType),
  ].filter((s): s is string => Boolean(s));
  const listMetaSegments = [
    lead.propertyType,
    surface,
    formatEtageForList(lead.etage, lead.propertyType),
    hasDisplayableAcquiredPrice(lead) && lead.acquiredPrice != null
      ? `${formatPrice(lead.acquiredPrice)} €`
      : null,
    contactabiliteListLabel(lead.contactabilite),
  ].filter((s): s is string => Boolean(s));
  const listAddressLine = leadListAddressLine(lead.address, lead.postalCode, lead.city);
  const acquiredPriceLabel =
    hasDisplayableAcquiredPrice(lead) && lead.acquiredPrice != null
      ? `${formatPrice(lead.acquiredPrice)} €`
      : null;
  const showPhone = hasDirectContactPhone(lead);
  const horsMarche = lead.marcheStatut === 'hors_marche' && Boolean(lead.marcheVerifieLe);
  const currentStage = stages.find((s) => s.id === lead.stageId) ?? null;
  const untreated = stages.length > 0 && lead.stageId == null;

  function stageControl() {
    if (untreated && onTake) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTake();
          }}
          aria-label="Ajouter au pipeline"
          className="inline-flex min-h-[32px] items-center rounded-full bg-accent px-3 text-[11.5px] font-semibold text-white sm:text-[12px]"
        >
          Ajouter au pipeline
        </button>
      );
    }
    if (stages.length > 0 && onStageChange && lead.stageId) {
      return <LeadStageBadge stage={currentStage} stages={stages} onChange={onStageChange} />;
    }
    return <StatusBadge status={lead.status} onChange={onStatusChange} />;
  }

  return (
    <div
      data-lead-card
      data-lead-id={lead.id}
      data-tour={index === 0 ? 'lead-card' : undefined}
      onClick={onClick}
      className={`relative isolate h-full cursor-pointer transition-[box-shadow,border-color,transform] duration-fluid-subtle ease-in-out animate-lead-reveal max-lg:rounded-2xl max-lg:border max-lg:border-black/[0.06] max-lg:bg-white max-lg:px-4 max-lg:py-5 max-lg:shadow-clay-sm max-lg:hover:border-black/[0.09] max-lg:hover:shadow-clay max-md:active:scale-[0.985] lg:flex lg:min-h-[112px] lg:items-center lg:gap-5 lg:rounded-none lg:border-0 lg:bg-white lg:px-6 lg:py-4 lg:shadow-none lg:hover:shadow-[inset_0_0_0_9999px_rgba(10,13,17,0.018)] ${
        !isLast ? 'lg:border-b lg:border-black/[0.05]' : ''
      }`}
      style={{
        animationDelay: stagger ? `${Math.min(index, 24) * 38}ms` : '0ms',
        WebkitTapHighlightColor: 'transparent',
      }}
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
            {stageControl()}
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
          <ScoreRing score={lead.score} size={52} />
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p
            className="flex min-w-0 items-center gap-x-1.5 truncate font-medium leading-snug text-ink"
            style={{ fontSize: 16, letterSpacing: '-0.01em' }}
          >
            <span className="min-w-0 truncate">{listAddressLine}</span>
            {horsMarche && (
              <InfoTooltip
                content="Aucune annonce correspondante détectée au moment de la livraison."
                placement="top-start"
              >
                <ShieldCheck
                  size={14}
                  strokeWidth={2.2}
                  className="shrink-0"
                  style={{ color: SLATE }}
                  aria-label="Absent des portails de vente"
                />
              </InfoTooltip>
            )}
          </p>
          <PropertyMetaLine segments={listMetaSegments} className="mt-1 min-w-0" />
        </div>
        <div
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          data-tour={index === 0 ? 'lead-feedback' : undefined}
        >
          {stageControl()}
        </div>
        <FacadeLead
          leadId={lead.id}
          lazy
          className="h-[92px] w-[148px] shrink-0"
        />
      </div>
    </div>
  );
}

export default memo(LeadCard);
