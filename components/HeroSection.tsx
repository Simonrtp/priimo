import Link from "next/link";
import Reveal from "./Reveal";
import HeroBackground from "./HeroBackground";
import HeroPillRotator from "./HeroPillRotator";
import HeroVideo from "./HeroVideo";
import { CALENDLY_URL } from "@/lib/calendly";

// === HERO SECTION ===
// Promesse compacte centrée, démo produit en vidéo (lecture au scroll, loop).

export default function HeroSection() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden pt-36 pb-10 sm:pt-44 sm:pb-16 lg:pt-52"
    >
      <HeroBackground />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 min-w-0">
        {/* === BLOC PROMESSE — compact, centré === */}
        <div className="mx-auto max-w-6xl text-center">
          <Reveal direction="up">
            <h1 className="text-hero headline mx-auto mb-5 flex max-w-6xl flex-col items-center text-center sm:mb-6">
              <span className="w-full text-balance text-gray-900">
                Le CRM immobilier qui propulse
                <span className="sm:hidden"> votre</span>
              </span>
              <span className="mt-[0.12em] flex items-center justify-center gap-[0.28em] text-gray-900">
                <span className="hidden sm:inline">votre</span>
                <span className="sr-only">
                  chiffre d&apos;affaires, productivité et prospection
                </span>
                <HeroPillRotator />
              </span>
            </h1>

            <p className="text-pretty mx-auto mt-1 max-w-[42rem] text-[1.125rem] font-medium leading-[1.65] text-gray-800 sm:mt-2 sm:max-w-[48rem] sm:text-[1.25rem]">
              Le premier outil pensé pour le terrain. Dictez vos notes à
              l&apos;
              <span className="font-bold">IA</span>, centralisez les{" "}
              <span className="font-bold">données</span> de votre secteur et
              automatisez votre <span className="font-bold">prospection</span> en un
              minimum de clics.
            </p>
          </Reveal>

          <Reveal direction="up" delay={120} className="mt-5 sm:mt-6">
            <div className="flex flex-col items-center gap-2.5">
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary shrink-0 px-4 py-2.5 text-[13.5px] sm:px-7 sm:py-3.5 sm:text-[15px]"
              >
                Réserver une démo
                <span data-arrow aria-hidden>
                  →
                </span>
              </a>

              <p className="small-text !normal-case !tracking-normal text-gray-600">
                Déjà client ?{" "}
                <Link
                  href="/login"
                  className="font-medium text-accent-dark hover:underline"
                >
                  Se connecter
                </Link>
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Démo produit — vidéo en boucle */}
      <div className="relative mx-auto mt-6 min-w-0 w-full max-w-4xl px-2 sm:mt-8 sm:max-w-[980px] sm:px-4 lg:max-w-[1120px]">
        <Reveal direction="scale" delay={180}>
          <div className="relative mx-auto w-full min-w-0 overflow-hidden rounded-[20px] bg-white shadow-[0_40px_100px_-36px_rgba(30,27,75,0.36)] ring-1 ring-black/[0.06] sm:rounded-[24px]">
            <HeroVideo />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
