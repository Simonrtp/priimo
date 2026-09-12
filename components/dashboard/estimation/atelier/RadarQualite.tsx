'use client';

import type { AxeRadar, FamilleGrilleId } from '@/lib/estimation/grille';

const LIBELLE_COURT: Record<FamilleGrilleId, string> = {
  elements_principaux: 'Principal',
  autres_elements: 'Autres',
  environnement: 'Envir.',
  criteres_generaux: 'Général',
  sejour: 'Séjour',
  cuisine: 'Cuisine',
  chambres: 'Chambres',
  sanitaires: 'Sanitaires',
  energie: 'Énergie',
};

const CX = 140;
const CY = 140;
const R = 108;

function polar(index: number, total: number, score: number, clamp = true) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const bounded = clamp ? Math.max(0, Math.min(5, score)) : score;
  const radius = (bounded / 5) * R;
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

function pathScores(axes: AxeRadar[]): string {
  const pts = axes
    .map((a, i) => (a.score == null ? null : polar(i, axes.length, a.score)))
    .filter((p): p is { x: number; y: number } => p != null);
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

export default function RadarQualite({
  bien,
  secteur,
}: {
  bien: AxeRadar[];
  secteur: AxeRadar[];
}) {
  const n = bien.length;
  const grille = [1, 2, 3, 4, 5].map((step) => {
    const pts = Array.from({ length: n }, (_, i) => polar(i, n, step));
    return pts.map((p) => `${p.x},${p.y}`).join(' ');
  });

  return (
    <svg viewBox="-24 -24 328 328" className="mx-auto h-auto w-full max-w-sm" role="img" aria-label="Radar qualité">
      {grille.map((points, i) => (
        <polygon key={i} points={points} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
      ))}
      {bien.map((_, i) => {
        const tip = polar(i, n, 5);
        return (
          <line
            key={`axe-${i}`}
            x1={CX}
            y1={CY}
            x2={tip.x}
            y2={tip.y}
            stroke="rgba(0,0,0,0.12)"
            strokeWidth="1"
          />
        );
      })}
      {pathScores(secteur) ? (
        <path d={pathScores(secteur)} fill="none" stroke="#1F8294" strokeWidth="3" strokeLinejoin="round" />
      ) : null}
      {pathScores(bien) ? (
        <path d={pathScores(bien)} fill="none" stroke="#1A1A1A" strokeWidth="3.5" strokeLinejoin="round" />
      ) : null}
      {bien.map((a, i) =>
        a.score == null ? null : (
          <circle key={a.famille} cx={polar(i, n, a.score).x} cy={polar(i, n, a.score).y} r="3.5" fill="#1A1A1A" />
        ),
      )}
      {bien.map((a, i) => {
        const p = polar(i, n, 5.65, false);
        return (
          <text
            key={`label-${a.famille}`}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-text-muted"
            fontSize="9"
          >
            {LIBELLE_COURT[a.famille]}
          </text>
        );
      })}
    </svg>
  );
}
