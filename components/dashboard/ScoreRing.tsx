interface ScoreRingProps {
  score: number;
  size?: number;
}

/**
 * Couleur de l'anneau selon le score :
 *   ≥ 80  rouge/orange vif (chaud)
 *   60-79 orange
 *   40-59 jaune
 *   < 40  gris
 */
const scoreStyle = (score: number) => {
  if (score >= 80) return { stroke: '#E85D2C', track: '#FFEDE3', text: '#C2410C' };
  if (score >= 60) return { stroke: '#F4A462', track: '#FFF1E1', text: '#B45309' };
  if (score >= 40) return { stroke: '#EAB308', track: '#FEF9C3', text: '#A16207' };
  return { stroke: '#94A3B8', track: '#EEF2F7', text: '#64748B' };
};

export default function ScoreRing({ score, size = 44 }: ScoreRingProps) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  // Score normalisé entre 0 et 99 — on plafonne à 100 % et minore à 0.
  const ratio = Math.max(0, Math.min(1, score / 100));
  const filled = ratio * c;
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
