interface ScoreRingProps {
  score: number;
  size?: number;
}

const scoreStyle = (score: number) => {
  if (score >= 80) return { stroke: '#E85D2C', track: '#FFEDE3', text: '#C2410C' };
  if (score >= 60) return { stroke: '#F4A462', track: '#FFF8F0', text: '#B45309' };
  return { stroke: '#94A3B8', track: '#EEF2F7', text: '#64748B' };
};

export default function ScoreRing({ score, size = 44 }: ScoreRingProps) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  const s = scoreStyle(score);

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.track} strokeWidth={3.5} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={s.stroke}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - filled}
        />
      </svg>
      <span
        className="relative z-10 font-bold leading-none tabular"
        style={{ fontSize: Math.round(size * 0.295), color: s.text }}
      >
        {score}
      </span>
    </div>
  );
}
