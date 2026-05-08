import { getScoreColor } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  const colors = getScoreColor(score);

  return (
    <div
      className="flex flex-col items-center justify-center rounded-[8px] flex-shrink-0"
      style={{
        width: '54px',
        height: '54px',
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      <span className="font-bold leading-none" style={{ fontSize: '18px' }}>
        {score}
      </span>
      <span className="font-medium" style={{ fontSize: '9px', opacity: 0.6 }}>
        /100
      </span>
    </div>
  );
}
