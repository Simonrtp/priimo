interface ScoreRingProps {
  score: number;
  size?: number;
  /** Halo / scale pour marqueurs carte (survol ou sélection). */
  emphasized?: boolean;
  /** Couleur de halo (rgba) — ex. heat.glow sur la carte. */
  glowColor?: string;
  className?: string;
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

export default function ScoreRing({
  score,
  size = 44,
  emphasized = false,
  glowColor,
  className = '',
}: ScoreRingProps) {
  const strokeWidth = size < 40 ? 3 : 3.5;
  const padding = strokeWidth + 3;
  const r = (size - padding * 2) / 2;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, score / 100));
  const filled = ratio * c;
  const s = scoreStyle(score);

  return (
    <div
      className={`relative flex flex-shrink-0 items-center justify-center rounded-full bg-white transition-transform duration-200 ease-out ${className}`}
      style={{
        width: size,
        height: size,
        transform: emphasized ? 'scale(1.14)' : 'scale(1)',
        boxShadow: emphasized
          ? `0 0 0 4px ${glowColor ?? 'rgba(232, 93, 44, 0.28)'}, 0 6px 16px rgba(0,0,0,0.18)`
          : '0 1px 4px rgba(0,0,0,0.08)',
      }}
      aria-label={`Score ${score}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={s.track}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={s.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - filled}
        />
      </svg>
      <span
        className="relative z-10 font-bold leading-none tabular-nums"
        style={{ fontSize: Math.round(size * 0.295), color: s.text }}
      >
        {score}
      </span>
    </div>
  );
}
