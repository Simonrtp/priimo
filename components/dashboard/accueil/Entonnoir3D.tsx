import { Filter } from 'lucide-react';
import {
  ETAPES_ENTONNOIR,
  type EtapeEntonnoir,
  type EtapeEntonnoirCle,
} from '@/lib/activite/entonnoir';
import type { Ratios } from '@/lib/activite/ratios';
import RatiosMoyens from './RatiosMoyens';

/**
 * Couleurs de la référence (photo 1), niveau par niveau.
 * Le violet du 2ᵉ étage est volontaire : fidélité à la maquette.
 */
const COULEUR: Record<EtapeEntonnoirCle, { face: string; sommet: string }> = {
  leads_pris: { face: '#2E86DE', sommet: '#1568C4' },
  contacts_qualifies: { face: '#9B5FE8', sommet: '#7A3DCF' },
  estimations: { face: '#1FA85A', sommet: '#148A45' },
  mandats: { face: '#F06B1A', sommet: '#D4520C' },
};

/** Libellés de la référence — pas ceux du modèle interne. */
const LIBELLE_REF: Record<EtapeEntonnoirCle, string> = {
  leads_pris: 'Contacts physiques',
  contacts_qualifies: 'Contacts qualifiés',
  estimations: 'Estimations / leads',
  mandats: 'Mandat signé',
};

/**
 * Largeurs : TOUJOURS le plus gros en haut, le plus petit en bas.
 * Sur chaque étage, haut > bas (se resserre vers le bas).
 */
const LARGEURS = [
  { haut: 260, bas: 195 },
  { haut: 200, bas: 150 },
  { haut: 145, bas: 105 },
  { haut: 100, bas: 70 },
] as const;

const VIEW_W = 280;
const CX = VIEW_W / 2;
const SEG_H = 58;
const GAP = 12;
const RY = 11;
const VIEW_H = RY + 4 * SEG_H + 3 * GAP + RY;

function formatePart(part: number, premier: boolean): string {
  if (premier) return '100 %';
  return `${Math.round(part).toLocaleString('fr-FR')} %`;
}

function Etage3D({
  etape,
  index,
  y,
}: {
  etape: EtapeEntonnoir;
  index: number;
  y: number;
}) {
  const { haut, bas } = LARGEURS[index]!;
  const c = COULEUR[etape.cle];
  const topY = y;
  const bottomY = y + SEG_H;
  const midY = y + SEG_H * 0.55;
  // Haut du trapèze = côté large ; bas = côté étroit.
  const leftTop = CX - haut / 2;
  const rightTop = CX + haut / 2;
  const leftBottom = CX - bas / 2;
  const rightBottom = CX + bas / 2;

  return (
    <g>
      <ellipse cx={CX} cy={bottomY} rx={bas / 2} ry={RY} fill={c.face} />
      <path
        d={`M ${leftTop} ${topY}
            L ${rightTop} ${topY}
            L ${rightBottom} ${bottomY}
            L ${leftBottom} ${bottomY}
            Z`}
        fill={c.face}
      />
      <ellipse cx={CX} cy={topY} rx={haut / 2} ry={RY} fill={c.sommet} />
      <text
        x={CX}
        y={midY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#FFFFFF"
        fontSize={28}
        fontWeight={700}
        style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}
      >
        {etape.valeur.toLocaleString('fr-FR')}
      </text>
    </g>
  );
}

/**
 * Entonnoir de conversion — reproduction fidèle de la référence photo 1.
 * Données = cohorte 12 semaines ; dessin = proportions et couleurs de la maquette.
 */
export default function Entonnoir3D({
  etapes,
  ratios,
}: {
  etapes: readonly EtapeEntonnoir[];
  ratios: Ratios;
}) {
  const parCle = new Map(etapes.map((e) => [e.cle, e]));
  const ordonnees = ETAPES_ENTONNOIR.map((cle) => {
    const connue = parCle.get(cle);
    if (connue) return connue;
    return {
      cle,
      libelle: LIBELLE_REF[cle],
      valeur: 0,
      part: 0,
      conversion: null,
    };
  });

  return (
    <section className="flex h-full min-h-0 flex-col rounded-clay-lg bg-surface p-5 shadow-clay sm:p-6">
      <div className="flex items-center gap-2">
        <Filter size={16} strokeWidth={2.4} className="shrink-0 text-blue-dark" aria-hidden />
        <h2 className="font-display text-[16px] font-bold leading-tight text-blue-dark sm:text-[17px]">
          Mon entonnoir de conversion
        </h2>
      </div>

      <div className="mt-5 grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(240px,0.85fr)] lg:items-stretch">
        <div className="grid min-h-0 grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-stretch gap-4 sm:gap-6">
          <div className="flex items-center justify-center">
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              className="h-[280px] w-full max-w-[280px] sm:h-[300px]"
              role="img"
              aria-label="Entonnoir de conversion en quatre étages"
            >
              {[...ordonnees]
                .map((etape, i) => ({ etape, i }))
                .reverse()
                .map(({ etape, i }) => (
                  <Etage3D
                    key={etape.cle}
                    etape={etape}
                    index={i}
                    y={RY + i * (SEG_H + GAP)}
                  />
                ))}
            </svg>
          </div>

          <ul
            className="grid min-w-0 content-stretch divide-y divide-black/[0.07]"
            style={{ gridTemplateRows: `repeat(${ordonnees.length}, 1fr)` }}
          >
            {ordonnees.map((etape, i) => (
              <li key={etape.cle} className="flex items-center justify-between gap-3 py-1">
                <span className="min-w-0 truncate text-[13px] font-medium text-text-muted sm:text-[14px]">
                  {LIBELLE_REF[etape.cle]}
                </span>
                <span className="shrink-0 font-display text-[14px] font-bold tabular-nums text-blue-dark sm:text-[15px]">
                    {formatePart(etape.part, i === 0 && etape.valeur > 0)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <RatiosMoyens ratios={ratios} />
      </div>
    </section>
  );
}
