import { getDpeFreshnessTier } from '@/lib/lead-dpe';
import type { Lead } from '@/types/lead';

interface DpeFreshnessChipProps {
  lead: Pick<Lead, 'dpeDate'>;
  className?: string;
}

export default function DpeFreshnessChip({ lead, className = '' }: DpeFreshnessChipProps) {
  const tier = getDpeFreshnessTier(lead);
  if (!tier) return null;

  if (tier === 'hot') {
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded-md border border-red-200/90 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-800 ${className}`}
      >
        <span aria-hidden className="mr-0.5">
          🔥
        </span>
        Signal chaud
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-800 ${className}`}
    >
      DPE récent
    </span>
  );
}
