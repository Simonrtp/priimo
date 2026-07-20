import Link from "next/link";
import { MapPinned, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import Reveal from "./Reveal";
import HeroBackground from "./HeroBackground";
import HeroVideo from "./HeroVideo";
import { CALENDLY_URL } from "@/lib/calendly";

// === HERO SECTION ===
// Promesse compacte centrée, démo produit en vidéo (lecture au scroll, loop).

const BULLETS: { text: string; Icon: LucideIcon }[] = [
  {
    text: "Arrivez avant vos concurrents",
    Icon: Zap,
  },
  {
    text: "Un secteur exclusif",
    Icon: MapPinned,
  },
  {
    text: "Conforme post-interdiction de la pige",
    Icon: ShieldCheck,
  },
];

export default function HeroSection() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden pt-24 sm:pt-28 pb-10 sm:pb-16"
    >
      <HeroBackground />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 min-w-0">
        {/* === BLOC PROMESSE — compact, centré === */}
        <div className="mx-auto max-w-6xl text-center">
          <Reveal direction="up">
            <h1 className="text-hero headline mx-auto max-w-[920px] sm:max-w-[980px] lg:max-w-[1100px] mb-5 sm:mb-6">
              Arrêtez de chasser les vendeurs. Recevez leurs adresses{" "}
              <span className="text-grad">chaque lundi</span>.
            </h1>

            <p className="text-body mx-auto mt-0 max-w-[820px] leading-[1.7] mb-4 sm:mb-5 sm:max-w-[880px] lg:max-w-[960px]">
              Priimo croise les données publiques et privées qui précèdent une vente :
              événement de vie, ventes en cascade, copropriété fragilisée, SCI en
              dissolution, DVF &amp; DPE, etc. et vous livre chaque lundi les adresses où
              un mandat se prépare.
            </p>

            <ul className="mt-4 flex flex-col items-center gap-2.5 sm:mt-5 lg:flex-row lg:flex-wrap lg:justify-center lg:gap-x-6 lg:gap-y-2 xl:gap-x-8">
              {BULLETS.map(({ text, Icon }, i) => (
                <Reveal
                  as="li"
                  key={text}
                  direction="up"
                  delay={80 + i * 90}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent-dark"
                    aria-hidden
                  >
                    <Icon size={13} strokeWidth={2.25} />
                  </span>
                  <span className="text-left text-[13.5px] font-semibold text-gray-600 sm:text-[14.5px]">
                    {text}
                  </span>
                </Reveal>
              ))}
            </ul>
          </Reveal>

          <Reveal direction="up" delay={120} className="mt-5 sm:mt-6">
            <div className="flex flex-col items-center gap-2.5">
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary w-full px-6 py-3.5 text-[15px] sm:w-auto sm:px-7 sm:py-3.5"
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
