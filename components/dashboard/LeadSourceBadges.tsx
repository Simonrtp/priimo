import { getLeadSourceLabels } from '@/lib/lead-dpe';
import type { Lead } from '@/types/lead';

interface LeadSourceBadgesProps {
  lead: Pick<Lead, 'ownerType' | 'dpeDate'>;
  className?: string;
}

export default function LeadSourceBadges({ lead, className = '' }: LeadSourceBadgesProps) {
  const labels = getLeadSourceLabels(lead);
  if (labels.length === 0) return null;

  return (
    <p className={`flex flex-wrap items-center gap-1 text-mute opacity-70 ${className}`} style={{ fontSize: 11 }}>
      {labels.map((label, i) => (
        <span key={label} className="inline-flex items-center">
          {i > 0 && <span className="mx-0.5 opacity-60" aria-hidden>·</span>}
          <span className="rounded-full bg-black/[0.06] px-1.5 py-px font-medium">{label}</span>
        </span>
      ))}
    </p>
  );
}
