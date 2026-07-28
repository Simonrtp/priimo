import type { ReactNode } from 'react';
import Reveal from '@/components/Reveal';
import HeroBackground from '@/components/HeroBackground';

// === FEATURE HERO ===
// En-tête commun des pages /fonctionnalites/* :
// même fond que le hero d'accueil + H1 display unifié.

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
    <header className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
      <HeroBackground />
      <div
        className={`relative mx-auto min-w-0 px-5 sm:px-8 ${
          hasMedia ? 'max-w-6xl' : 'max-w-[760px]'
        }`}
      >
        <Reveal direction="up">
          <p className="text-[11px] font-semibold uppercase text-[#E8743C] [letter-spacing:0.08em]">
            {label}
          </p>

          {hasMedia ? (
            <div className="mt-3 grid items-center gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_min(100%,380px)] lg:gap-x-10 xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-x-12">
              <div className="min-w-0">
                <h1 className="feature-hero-h1 text-balance">{h1}</h1>
                <p className="text-body mt-4 text-gray-600 text-pretty">{accroche}</p>
              </div>
              <div className="mx-auto w-full max-w-[320px] sm:max-w-[360px] lg:mx-0 lg:max-w-none lg:justify-self-end">
                {media}
              </div>
            </div>
          ) : (
            <>
              <h1 className="feature-hero-h1 mt-3 text-balance">{h1}</h1>
              <p className="text-body mt-4 text-gray-600 text-pretty">{accroche}</p>
            </>
          )}
        </Reveal>
      </div>
      {/* Fondu vers la section suivante (fond blanc) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-white sm:h-24"
      />
    </header>
  );
}
