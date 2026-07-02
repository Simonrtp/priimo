'use client';

import type { Lead } from '@/types/lead';
import { getMainSignalLabel } from '@/lib/lead-meta';
import ScoreRing from '../ScoreRing';

interface LeadMapCardProps {
  lead: Lead;
  active: boolean;
  onClick: () => void;
  onHover: (hovering: boolean) => void;
}

export default function LeadMapCard({ lead, active, onClick, onHover }: LeadMapCardProps) {
  const typeLabel = lead.ownerType === 'entreprise' ? 'SCI / Entreprise' : 'Particulier';
  const signal = getMainSignalLabel(lead);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      data-active={active}
      className={`group flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-150 ${
        active
          ? 'border-primary-400/50 bg-primary-50 shadow-clay-sm'
          : 'border-primary-100 bg-surface hover:border-primary-200 hover:bg-primary-50/40'
      }`}
    >
      <ScoreRing score={lead.score} size={36} className="mt-0.5" />

      <span className="min-w-0 flex-1">
        <span
          className="block text-pretty font-semibold leading-snug text-ink"
          style={{ fontSize: 13.5, letterSpacing: '-0.01em' }}
        >
          {lead.address}
        </span>
        <span className="mt-0.5 block text-mute" style={{ fontSize: 11.5 }}>
          {typeLabel}
          {lead.postalCode ? <span className="mx-1 opacity-40">·</span> : null}
          {lead.postalCode ?? ''}
        </span>
        <span className="mt-1 block truncate text-[#374151]" style={{ fontSize: 11.5 }}>
          {signal}
        </span>
      </span>
    </button>
  );
}
