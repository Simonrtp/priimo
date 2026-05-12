'use client';

import type { Lead, LeadSegmentTab } from '@/types/lead';
import ScoreRing from './ScoreRing';
import StatusBadge from './StatusBadge';
import { getMainSignalLabel, formatPrice } from '@/lib/utils';
import { ICONS, ICON_COLORS, ICON_SIZE, lifeEventChipMeta } from '@/lib/iconMapping';

interface LeadCardProps {
  lead: Lead;
  index: number;
  isLast: boolean;
  segmentTab: LeadSegmentTab;
  isPlanPremium: boolean;
  onClick: () => void;
  onStatusChange: (status: Lead['status']) => void;
}

function SegmentRowIcon({ tab, lead }: { tab: LeadSegmentTab; lead: Lead }) {
  if (tab === 'particuliers') return null;
  if (tab === 'entreprises' && !lead.legalForm) return null;
  if (tab === 'tous' && lead.segment === 'entreprise' && lead.legalForm) {
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
  isPlanPremium,
  onClick,
  onStatusChange,
}: LeadCardProps) {
  const isHighIntent = lead.score >= 80 && lead.lifeEvent !== null;
  const year = new Date(lead.purchaseDate).getFullYear();
  const signal = getMainSignalLabel(lead);
  const showDirectorPhoneHint =
    isPlanPremium &&
    lead.segment === 'entreprise' &&
    lead.directorPhoneProAvailable &&
    !!lead.directorPhonePro?.trim();

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center gap-4 px-5 py-[18px] cursor-pointer hover:bg-black/[0.018] transition-colors duration-150 animate-lead-reveal ${
        !isLast ? 'border-b border-black/[0.05]' : ''
      }`}
      style={{ animationDelay: `${index * 38}ms` }}
    >
      {isHighIntent && (
        <span className="absolute left-0 top-4 bottom-4 w-[3px] bg-accent rounded-r-[2px]" />
      )}

      <ScoreRing score={lead.score} size={44} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-0.5">
          <SegmentRowIcon tab={segmentTab} lead={lead} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-semibold text-ink truncate"
                style={{ fontSize: 14, letterSpacing: '-0.01em' }}
              >
                {lead.address}
              </span>
              {lead.lifeEvent && (() => {
                const ev = lead.lifeEvent;
                const { Icon, color, label } = lifeEventChipMeta(ev);
                return (
                  <span
                    className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-accent/10 font-medium text-accent-dark"
                    style={{ fontSize: 10, padding: '2px 8px', letterSpacing: '0.01em' }}
                  >
                    <Icon size={14} color={color} strokeWidth={2} aria-hidden />
                    {label}
                  </span>
                );
              })()}
            </div>
            {lead.companyOwnerLine && (
              <p className="text-[#374151] font-medium truncate mt-0.5" style={{ fontSize: 12 }}>
                {lead.companyOwnerLine}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="text-mute truncate flex-1" style={{ fontSize: 12.5 }}>
            {signal}
            <span className="mx-1.5 opacity-40">·</span>
            {lead.propertyType}
            <span className="mx-1.5 opacity-40">·</span>
            {lead.surface} m²
          </p>
          {showDirectorPhoneHint && (
            <span className="flex-shrink-0 cursor-default" title="Coordonnées dirigeant disponibles">
              <ICONS.phone
                size={ICON_SIZE.sm}
                color={ICON_COLORS.green600}
                strokeWidth={2}
                aria-hidden
              />
            </span>
          )}
        </div>
      </div>

      <div className="hidden lg:block text-right flex-shrink-0" style={{ width: 110 }}>
        <p className="text-ink font-medium tabular" style={{ fontSize: 12.5 }}>
          {formatPrice(lead.purchasePrice)} €
        </p>
        <p className="text-mute tabular" style={{ fontSize: 11.5 }}>
          {year}
        </p>
      </div>

      <div className="flex-shrink-0">
        <StatusBadge status={lead.status} onChange={onStatusChange} />
      </div>
    </div>
  );
}
