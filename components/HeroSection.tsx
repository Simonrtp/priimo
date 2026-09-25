import Reveal from "./Reveal";
import HeroPillRotator from "./HeroPillRotator";
import HeroVideo from "./HeroVideo";
import CtaButton from "./CtaButton";

// === HERO SECTION ===
// Mise en page type Tiime : promesse à gauche, démo à droite,
// bloc sombre avec l’angle bas-droit arrondi.

export default function HeroSection() {
  return (
    <section
      id="top"
      className="landing-hero relative isolate overflow-hidden pt-[8.75rem] pb-14 sm:pt-40 sm:pb-16 lg:pt-44 lg:pb-20"
    >
      <div className="landing-hero-grid relative min-w-0">
        <div className="min-w-0 max-w-xl text-left lg:max-w-none lg:pt-4">
          <Reveal direction="up">
            <h1 className="text-hero headline mb-3 flex flex-col items-start text-left">
              <span className="w-full">
                Le CRM immobilier pensé
                <span className="sm:hidden"> pour</span>
              </span>
              <span className="mt-[0.04em] flex w-full flex-wrap items-center gap-[0.22em]">
                <span className="hidden sm:inline">pour</span>
                <span className="sr-only">
                  la prospection, le terrain et la data
                </span>
                <HeroPillRotator />
              </span>
            </h1>

            <p className="text-body text-pretty max-w-md font-medium leading-snug">
              Le premier outil pensé pour le terrain. Dictez vos notes à
              l&apos;
              <span className="font-bold">IA</span>, centralisez les{" "}
              <span className="font-bold">données</span> de votre secteur et
              automatisez votre <span className="font-bold">prospection</span>{" "}
              en un minimum de clics.
            </p>
          </Reveal>

          <Reveal direction="up" delay={120} className="mt-4">
            <div className="flex flex-col items-start">
              <CtaButton className="shrink-0 px-4 py-2.5 text-[13.5px] sm:px-7 sm:py-3.5 sm:text-[15px]">
                Réserver une démo
                <span data-arrow aria-hidden>
                  →
                </span>
              </CtaButton>

              <p className="mt-3 small-text !normal-case !tracking-normal">
                1 mois gratuit sans engagement
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal direction="fade" delay={180} className="landing-hero-media-wrap min-w-0">
          <div className="landing-hero-media relative w-full min-w-0 overflow-hidden">
            <HeroVideo fill />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
