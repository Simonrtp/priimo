'use client';

import { Mic } from 'lucide-react';
import { goutte } from '@/lib/ui/goutte';
import { armPointerShield } from '@/lib/ui/pointer-guard';
import { useVoiceCapture } from './VoiceCaptureProvider';

/** Pilule de 36 px (`h-9` côté barre), cercle blanc de 44 px, micro bleu de 36 px (halo 4 px). */
const FORME = goutte({ hauteurPilule: 36, rayonCercle: 22, ecart: 42, rayonCoin: 12, rayonCol: 10 });
const RAYON_MICRO = 18;

const LIBELLE = 'Dicter : une note, ou une question à Mon assistant';

/**
 * Le seul micro du bureau, accroché au bout de la barre de recherche. Une
 * dictée devient une note ; une question part à Mon assistant, qui répond
 * dans la même feuille.
 */
export default function MicroGoutte() {
  const { openCapture } = useVoiceCapture();

  return (
    <div
      className="relative shrink-0"
      style={{ width: FORME.largeur, height: FORME.hauteur, marginLeft: -2 }}
    >
      <svg
        aria-hidden
        width={FORME.largeur}
        height={FORME.hauteur}
        viewBox={`0 0 ${FORME.largeur} ${FORME.hauteur}`}
        className="pointer-events-none absolute inset-0 overflow-visible"
      >
        <path d={FORME.chemin} fill="#FFFFFF" />
        {/* Cercle plein sous le micro : halo blanc régulier, le col ne le grignote plus. */}
        <circle cx={FORME.cx} cy={FORME.cy} r={FORME.rayon} fill="#FFFFFF" />
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
      className={`group/micro relative isolate flex items-center justify-center overflow-hidden rounded-full bg-ia text-white transition-transform duration-fluid-subtle ease-in-out active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
      style={{ width: taille, height: taille, ...style }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[150%] translate-y-full rounded-t-[50%_9px] bg-[#0B0F1E] transition-transform duration-[850ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/micro:translate-y-0 group-focus-visible/micro:translate-y-0 motion-reduce:transition-none"
      />
      <Mic
        size={Math.round(taille * 0.52)}
        strokeWidth={2.4}
        aria-hidden
        className="relative z-10"
      />
    </button>
  );
}
