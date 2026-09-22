import { formatEuro } from '@/lib/rapport/genere/format';

export function BarreFourchette({
  low,
  mid,
  high,
  accent,
}: {
  low: number;
  mid: number;
  high: number;
  accent: string;
}) {
  const min = Math.min(low, mid, high);
  const max = Math.max(low, mid, high);
  const span = max - min || 1;
  const x = (v: number) => 16 + ((v - min) / span) * 268;
  return (
    <svg viewBox="0 0 300 64" width="100%" height="64" aria-hidden>
      <line x1="16" y1="28" x2="284" y2="28" stroke="#D7D2CB" strokeWidth="6" strokeLinecap="round" />
      <line
        x1={x(low)}
        y1="28"
        x2={x(high)}
        y2="28"
        stroke={accent}
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.35"
      />
      <circle cx={x(low)} cy="28" r="5" fill="#3D5A80" />
      <circle cx={x(high)} cy="28" r="5" fill="#3D5A80" />
      <circle cx={x(mid)} cy="28" r="7" fill={accent} />
      <text x={x(low)} y="52" textAnchor="middle" fontSize="9" fill="#3D5A80" fontFamily="Inter, sans-serif">
        {formatEuro(low)}
      </text>
      <text x={x(mid)} y="12" textAnchor="middle" fontSize="9" fill="#0A0D11" fontFamily="Inter, sans-serif">
        {formatEuro(mid)}
      </text>
      <text x={x(high)} y="52" textAnchor="middle" fontSize="9" fill="#3D5A80" fontFamily="Inter, sans-serif">
        {formatEuro(high)}
      </text>
    </svg>
  );
}

export function JaugeCirculaire({
  valeur,
  max,
  label,
  accent,
  format,
}: {
  valeur: number;
  max: number;
  label: string;
  accent: string;
  format: (n: number) => string;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.min(1, Math.max(0, valeur / max)) : 0;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 100 88" width="112" height="98" aria-hidden>
        <circle cx="50" cy="46" r={r} fill="none" stroke="#E8E0D8" strokeWidth="8" />
        <circle
          cx="50"
          cy="46"
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth="8"
          strokeDasharray={`${c * ratio} ${c}`}
          strokeLinecap="round"
          transform="rotate(-90 50 46)"
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="#0A0D11"
          fontFamily="Inter, sans-serif"
        >
          {format(valeur)}
        </text>
      </svg>
      <p className="avis-label" style={{ margin: 0 }}>
        {label}
      </p>
    </div>
  );
}

export function NuageComparables({
  points,
  bien,
  mediane,
  accent,
}: {
  points: Array<{ x: number; y: number }>;
  bien: { x: number; y: number } | null;
  mediane: number | null;
  accent: string;
}) {
  if (points.length < 2 && !bien) return null;
  const xs = [...points.map((p) => p.x), bien?.x].filter((n): n is number => n != null);
  const ys = [...points.map((p) => p.y), bien?.y, mediane].filter((n): n is number => n != null);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const px = (x: number) => 28 + ((x - minX) / spanX) * 250;
  const py = (y: number) => 12 + (1 - (y - minY) / spanY) * 86;
  return (
    <svg viewBox="0 0 300 120" width="100%" height="120" aria-hidden>
      {mediane != null ? (
        <line
          x1="28"
          x2="278"
          y1={py(mediane)}
          y2={py(mediane)}
          stroke="#3D5A80"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
      ) : null}
      {points.map((p, i) => (
        <circle key={i} cx={px(p.x)} cy={py(p.y)} r="3.5" fill="#3D5A80" />
      ))}
      {bien ? <circle cx={px(bien.x)} cy={py(bien.y)} r="6" fill={accent} /> : null}
    </svg>
  );
}
