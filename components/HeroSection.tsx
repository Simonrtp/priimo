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
    text: "Conforme post-interdiction de la pige (11 août 2026)",
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
              Priimo croise données publiques et privées pour repérer les logements où
              une vente se prépare. Chaque lundi, une liste courte sur votre secteur :
              l&apos;adresse, le propriétaire quand il est identifiable, le contexte, et
              les contacts des voisins de l&apos;immeuble. Chaque adresse est
              vérifiée absente des portails de vente.
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
              {/*
                Mobile : bouton puis flèche + texte en dessous (évite le débordement).
                Desktop : bouton centré ; flèche/texte en absolute à sa droite.
              */}
              <div className="relative flex w-full flex-col items-center gap-3 sm:w-auto sm:gap-0">
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

                <div className="flex items-center justify-center gap-1.5 overflow-visible sm:absolute sm:left-[calc(100%+0.4rem)] sm:top-[42%] sm:-translate-y-1/2 sm:justify-start sm:gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/cta-arrow.png"
                    alt=""
                    width={160}
                    height={34}
                    className="h-auto w-9 shrink-0 object-contain object-right sm:w-[6.5rem]"
                    aria-hidden
                    draggable={false}
                  />
                  <p
                    className="shrink-0 text-left text-[12.5px] font-semibold leading-[1.3] text-gray-900 sm:text-[13px]"
                    style={{
                      fontFamily:
                        'var(--font-display), var(--font-sans), system-ui, sans-serif',
                      transform: 'rotate(-8deg)',
                      paddingLeft: '0.15rem',
                      paddingRight: '0.35rem',
                      paddingBottom: '0.2rem',
                    }}
                  >
                    1 mois
                    <br />
                    <span className="rounded-[2px] px-0.5 [box-decoration-break:clone] [background:linear-gradient(transparent_12%,rgba(99,102,241,0.22)_12%,rgba(99,102,241,0.22)_88%,transparent_88%)]">
                      gratuit
                    </span>{' '}
                    sans
                    <br />
                    <span className="rounded-[2px] px-0.5 [box-decoration-break:clone] [background:linear-gradient(transparent_12%,rgba(99,102,241,0.22)_12%,rgba(99,102,241,0.22)_88%,transparent_88%)]">
                      engagement
                    </span>
                  </p>
                </div>
              </div>

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
