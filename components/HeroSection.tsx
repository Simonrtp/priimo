import Reveal from "./Reveal";
import HeroPillRotator from "./HeroPillRotator";
import HeroMediaRotator from "./HeroMediaRotator";
import CtaButton from "./CtaButton";
import { fontHero } from "@/lib/fonts-hero";

// === HERO SECTION ===
// Mise en page type Tiime : promesse à gauche, photos produit à droite
// (même cadre 3/2, rotation carte ↔ téléphone),
// bloc sombre avec l’angle bas-droit arrondi.
// Titre : Montserrat ExtraBold uppercase (réf. typo fournie), uniquement sur le h1.

export default function HeroSection() {
  return (
    <section
      id="top"
      className="landing-hero relative isolate overflow-hidden pt-[8.75rem] pb-14 sm:pt-40 sm:pb-16 lg:pt-44 lg:pb-20"
    >
      <div className="landing-hero-grid relative min-w-0">
        <div className="landing-hero-copy min-w-0 text-left lg:pt-2">
          <Reveal direction="up">
            <h1
              className={`${fontHero.className} landing-hero-title mb-4 flex flex-col items-start text-left`}
            >
              <span className="block">Le CRM immobilier</span>
              <span className="mt-[0.22em] block">pensé pour</span>
              <span className="mt-[0.28em] flex w-full max-w-none justify-start overflow-visible">
                <span className="sr-only">
                  la prospection, le terrain et la data
                </span>
                <HeroPillRotator />
              </span>
            </h1>

            <ul className="landing-hero-points mt-1 max-w-md space-y-2.5">
              <li>
                Dictez vos notes à l&apos;<span className="font-bold">IA</span>
              </li>
              <li>
                Centralisez les <span className="font-bold">données</span> de
                votre secteur
              </li>
              <li>
                Automatisez votre <span className="font-bold">prospection</span>{" "}
                en un minimum de clics
              </li>
            </ul>
          </Reveal>

          <Reveal direction="up" delay={120} className="mt-5">
            <div className="flex flex-col items-start pb-1">
              <CtaButton className="shrink-0 px-4 py-2.5 text-[13.5px] sm:px-7 sm:py-3.5 sm:text-[15px]">
                Réserver une démo
              </CtaButton>

              <p className="mt-3 small-text !normal-case !tracking-normal leading-normal">
                1 mois gratuit sans engagement
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal direction="fade" delay={180} className="landing-hero-media-wrap min-w-0">
          <HeroMediaRotator />
        </Reveal>
      </div>
    </section>
  );
}
