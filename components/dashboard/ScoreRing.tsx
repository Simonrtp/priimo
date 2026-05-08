interface ScoreRingProps {
  score: number;
  size?: number;
}

const scoreStyle = (score: number) => {
  if (score >= 80) return { stroke: '#E8743C', track: '#FFF3EA', text: '#C25E2C' };
  if (score >= 50) return { stroke: '#3D5A80', track: '#EEF2F7', text: '#293F5C' };
  return { stroke: '#C8C8BF', track: '#F1F1EE', text: '#9CA3AF' };
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
