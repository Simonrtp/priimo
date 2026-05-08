'use client';

import type { Lead } from '@/types/lead';
import ScoreRing from './ScoreRing';
import StatusBadge from './StatusBadge';
import { getMainSignalLabel, formatPrice } from '@/lib/utils';

interface LeadCardProps {
  lead: Lead;
  index: number;
  isLast: boolean;
  onClick: () => void;
  onStatusChange: (status: Lead['status']) => void;
}

const lifeEventLabels: Record<string, string> = {
  liquidation_pro:   '🔥 Liquidation pro',
  dissolution_sci:   '⚡ Dissolution SCI',
  cession_entreprise: '🔄 Cession',
};

export default function LeadCard({ lead, index, isLast, onClick, onStatusChange }: LeadCardProps) {
  const isPremium = lead.score >= 80 && lead.lifeEvent !== null;
  const year = new Date(lead.purchaseDate).getFullYear();
  const signal = getMainSignalLabel(lead);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center gap-4 px-5 py-[18px] cursor-pointer hover:bg-black/[0.018] transition-colors duration-150 animate-lead-reveal ${
        !isLast ? 'border-b border-black/[0.05]' : ''
      }`}
      style={{ animationDelay: `${index * 38}ms` }}
    >
      {/* Premium left indicator */}
      {isPremium && (
        <span className="absolute left-0 top-4 bottom-4 w-[3px] bg-accent rounded-r-[2px]" />
      )}

      {/* Score ring */}
      <ScoreRing score={lead.score} size={44} />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
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
        <p className="text-mute truncate" style={{ fontSize: 12.5 }}>
          {signal}
          <span className="mx-1.5 opacity-40">·</span>
          {lead.propertyType}
          <span className="mx-1.5 opacity-40">·</span>
          {lead.surface} m²
        </p>
      </div>

      {/* Property meta */}
      <div className="hidden lg:block text-right flex-shrink-0" style={{ width: 110 }}>
        <p className="text-ink font-medium tabular" style={{ fontSize: 12.5 }}>
          {formatPrice(lead.purchasePrice)} €
        </p>
        <p className="text-mute tabular" style={{ fontSize: 11.5 }}>
          {year}
        </p>
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        <StatusBadge status={lead.status} onChange={onStatusChange} />
      </div>
    </div>
  );
}
