import Reveal from '@/components/Reveal';

// === FEATURE HERO ===
// En-tête des pages /fonctionnalites/*. Structure et textes inchangés
// (label + H1 + accroche) — seule la mise en scène des sections change en aval.

type FeatureHeroProps = {
  label: string;
  h1: string;
  accroche: string;
};

export default function FeatureHero({ label, h1, accroche }: FeatureHeroProps) {
  return (
    <header className="bg-[#FFF7F0] pt-28 pb-12 sm:pt-32 sm:pb-16">
      <div className="mx-auto max-w-[760px] px-5 sm:px-8 min-w-0">
        <Reveal direction="up">
          <p className="text-[11px] font-semibold uppercase text-[#E8743C] [letter-spacing:0.08em]">
            {label}
          </p>
          <h1 className="text-h1 headline mt-3 text-balance">
            {h1}
          </h1>
          <p className="text-body mt-4 text-gray-600 text-pretty">{accroche}</p>
        </Reveal>
      </div>
    </header>
  );
}
