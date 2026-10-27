'use client';

import { useId } from 'react';
import { Mic } from 'lucide-react';
import { goutte } from '@/lib/ui/goutte';
import { armPointerShield } from '@/lib/ui/pointer-guard';
import { useVoiceCapture } from './VoiceCaptureProvider';

/** Pilule de 36 px (`h-9` côté barre), cercle blanc de 48 px, micro bleu de 40 px. */
const FORME = goutte({ hauteurPilule: 36, rayonCercle: 24, bout: 26, espace: 3, flou: 7, seuil: 0.48 });
const RAYON_MICRO = 20;

const LIBELLE = 'Dicter : une note, ou une question à Mon assistant';

/**
 * Le seul micro du bureau, accroché au bout de la barre de recherche. Une
 * dictée devient une note ; une question part à Mon assistant, qui répond
 * dans la même feuille.
 */
export default function MicroGoutte() {
  const { openCapture } = useVoiceCapture();
  const filtre = `goutte-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { bout, zone, contraste } = FORME;

  return (
    <div className="relative shrink-0" style={{ width: FORME.largeur, height: FORME.hauteur }}>
      <svg
        aria-hidden
        width={FORME.largeur}
        height={FORME.hauteur}
        className="pointer-events-none absolute inset-0 overflow-visible"
      >
        <defs>
          <filter
            id={filtre}
            filterUnits="userSpaceOnUse"
            x={zone.x}
            y={zone.y}
            width={zone.w}
            height={zone.h}
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation={FORME.flou} />
            <feColorMatrix values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contraste.pente} ${contraste.decalage}`} />
          </filter>
        </defs>
        {/* Deux gouttes proches : le filtre les fond en une seule, col lisse. */}
        <g filter={`url(#${filtre})`} fill="#FFFFFF">
          <rect x={bout.x} y={bout.y} width={bout.w} height={bout.h} />
          <circle cx={FORME.cx} cy={FORME.cy} r={24} />
        </g>
      </svg>
      <BoutonMicro
        taille={RAYON_MICRO * 2}
        className="absolute"
        style={{ left: FORME.cx - RAYON_MICRO, top: FORME.cy - RAYON_MICRO }}
        onClick={() => {
          armPointerShield();
          // Dans le geste : le micro et le direct s'ouvrent sans attendre.
          openCapture();
        }}
      />
    </div>
  );
}

/** Le cercle bleu seul, quand il n'y a pas de barre à laquelle l'accrocher. */
export function BoutonMicro({
  taille = 44,
  className = '',
  style,
  onClick,
}: {
  taille?: number;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const { openCapture } = useVoiceCapture();
  return (
    <button
      type="button"
      data-tour="voice-capture"
      onClick={
        onClick ??
        (() => {
          armPointerShield();
          openCapture();
        })
      }
      aria-label={LIBELLE}
      title={LIBELLE}
      className={`micro-btn group/micro relative isolate flex items-center justify-center overflow-hidden rounded-full bg-ia text-white transition-transform duration-fluid-subtle ease-in-out active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
      style={{ width: taille, height: taille, ...style }}
    >
      {/* Une page noire monte du bas du cercle, bord haut légèrement courbe. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[150%] translate-y-full rounded-t-[50%_9px] bg-[#0B0F1E] transition-transform duration-[850ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/micro:translate-y-0 group-focus-visible/micro:translate-y-0 motion-reduce:transition-none"
      />
      {/* Au survol : une seule vague de voix traverse le cercle, puis le micro revient, en blanc. */}
      <span aria-hidden className="absolute inset-0 flex items-center justify-center gap-[2px]">
        {[0.35, 0.65, 1, 0.8, 0.5, 0.75, 0.4].map((h, i) => (
          <span
            key={i}
            className="micro-vague-barre w-[2px] rounded-full bg-white"
            style={{ height: Math.round(taille * 0.5 * h), animationDelay: `${420 + i * 70}ms` }}
          />
        ))}
      </span>
      <Mic size={Math.round(taille * 0.52)} strokeWidth={2.4} aria-hidden className="micro-icone" />
    </button>
  );
}
