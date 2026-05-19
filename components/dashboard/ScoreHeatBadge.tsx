import { scoreHeatTier } from '@/lib/lead-display';

interface ScoreHeatBadgeProps {
  score: number;
  className?: string;
}

export default function ScoreHeatBadge({ score, className = '' }: ScoreHeatBadgeProps) {
  const tier = scoreHeatTier(score);
  if (!tier) return null;

  return (
    <span
      className={`inline-flex max-w-full items-center justify-center rounded-full px-2 py-0.5 text-center font-semibold leading-tight whitespace-nowrap ${tier.chipClass} ${className}`}
      style={{ fontSize: 10 }}
    >
      {tier.label}
    </span>
  );
}
