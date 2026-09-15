import Reveal from '@/components/Reveal';
import HeroBackground from '@/components/HeroBackground';

type FeatureHeroProps = {
  label: string;
  h1: string;
  mecanisme: [string, string];
};

export default function FeatureHero({ label, h1, mecanisme }: FeatureHeroProps) {
  return (
    <header className="relative isolate overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
      <HeroBackground />
      <div className="relative mx-auto min-w-0 max-w-[760px] px-5 sm:px-8">
        <Reveal direction="up">
          <p className="text-[11px] font-semibold uppercase text-[#E8743C]">
            {label}
          </p>
          <h1 className="text-hero headline mt-3 text-balance text-gray-900">
            {h1}
          </h1>
          <p className="mt-5 text-pretty text-[1.05rem] font-medium leading-[1.65] text-gray-800 sm:text-[1.125rem]">
            {mecanisme[0]}
          </p>
          <p className="mt-3 text-pretty text-[1.05rem] font-medium leading-[1.65] text-gray-800 sm:text-[1.125rem]">
            {mecanisme[1]}
          </p>
        </Reveal>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-white sm:h-24"
      />
    </header>
  );
}
