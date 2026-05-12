'use client';

import type { Lead, LeadSegmentTab, LifeEvent } from '@/types/lead';
import ScoreRing from './ScoreRing';
import StatusBadge from './StatusBadge';
import { getMainSignalLabel, formatPrice } from '@/lib/utils';

interface LeadCardProps {
  lead: Lead;
  index: number;
  isLast: boolean;
  segmentTab: LeadSegmentTab;
  isPlanPremium: boolean;
  onClick: () => void;
  onStatusChange: (status: Lead['status']) => void;
}

const lifeEventLabels: Record<Exclude<LifeEvent, null>, string> = {
  dissolution_sci: '⚡ Dissolution SCI',
  liquidation: '🔥 Liquidation',
  cession_parts: '🔄 Cession de parts',
  changement_gerant: '👤 Changement gérant',
  deces_associe: '⚫ Décès associé',
};

function leftSegmentIcon(tab: LeadSegmentTab, lead: Lead): string | null {
  if (tab === 'particuliers') return null;
  if (tab === 'entreprises') return lead.legalForm ? '🏢' : null;
  if (lead.segment === 'entreprise' && lead.legalForm) return '🏢';
  return '👤';
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
  const segIcon = leftSegmentIcon(segmentTab, lead);
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
          {segIcon && (
            <span
              className="flex-shrink-0 leading-none select-none"
              style={{ fontSize: 14, color: '#374151' }}
              aria-hidden
            >
              {segIcon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-semibold text-ink truncate"
                style={{ fontSize: 14, letterSpacing: '-0.01em' }}
              >
                {lead.address}
              </span>
              {lead.lifeEvent && (
                <span
                  className="flex-shrink-0 bg-accent/10 text-accent-dark rounded-full font-medium"
                  style={{ fontSize: 10, padding: '2px 8px', letterSpacing: '0.01em' }}
                >
                  {lifeEventLabels[lead.lifeEvent]}
                </span>
              )}
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
            <span
              className="flex-shrink-0 text-[13px] leading-none cursor-default"
              style={{ color: '#059669' }}
              title="Coordonnées dirigeant disponibles"
            >
              📞
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
