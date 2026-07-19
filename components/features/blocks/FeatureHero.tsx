import type { ReactNode } from 'react';
import Reveal from '@/components/Reveal';

// === FEATURE HERO ===
// En-tête des pages /fonctionnalites/*. Structure et textes inchangés
// (label + H1 + accroche) — seule la mise en scène des sections change en aval.

type FeatureHeroProps = {
  label: string;
  h1: string;
  accroche: string;
  /** Visuel optionnel à droite du H1 (ex. démo vidéo sur /livraison). */
  media?: ReactNode;
};

export default function FeatureHero({ label, h1, accroche, media }: FeatureHeroProps) {
  const hasMedia = Boolean(media);

  return (
    <header className="bg-[#FEF9EF] pt-28 pb-12 sm:pt-32 sm:pb-16">
      <div
        className={`mx-auto min-w-0 px-5 sm:px-8 ${
          hasMedia ? 'max-w-6xl' : 'max-w-[760px]'
        }`}
      >
        <Reveal direction="up">
          <p className="text-[11px] font-semibold uppercase text-[#E8743C] [letter-spacing:0.08em]">
            {label}
          </p>

          {hasMedia ? (
            <div className="mt-3 grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_min(100%,380px)] lg:items-start lg:gap-x-10 xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-x-12">
              <div className="min-w-0">
                <h1 className="text-h1 headline text-balance">{h1}</h1>
                <p className="text-body mt-4 text-gray-600 text-pretty">{accroche}</p>
              </div>
              <div className="mx-auto w-full max-w-[320px] sm:max-w-[360px] lg:mx-0 lg:max-w-none lg:justify-self-end">
                {media}
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-h1 headline mt-3 text-balance">{h1}</h1>
              <p className="text-body mt-4 text-gray-600 text-pretty">{accroche}</p>
            </>
          )}
        </Reveal>
      </div>
    </header>
  );
}
