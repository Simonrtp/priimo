"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ListOrdered, MapPinned, ShieldCheck, type LucideIcon } from "lucide-react";
import Reveal from "./Reveal";
import HeroBackground from "./HeroBackground";
import { CALENDLY_URL } from "@/lib/calendly";

// === HERO SECTION ===
// Promesse compacte centrée, démo produit en vidéo (lecture au scroll, loop).

const BULLETS: { text: string; Icon: LucideIcon }[] = [
  {
    text: "Liste courte et priorisée",
    Icon: ListOrdered,
  },
  {
    text: "Secteur exclusif",
    Icon: MapPinned,
  },
  {
    text: "Prêt pour l'interdiction de la pige (11 août 2026)",
    Icon: ShieldCheck,
  },
];

function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasStartedRef.current) return;
        hasStartedRef.current = true;
        void video.play().catch(() => {
          hasStartedRef.current = false;
        });
        observer.disconnect();
      },
      { threshold: 0.3 },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      className="block h-auto w-full"
      loop
      muted
      playsInline
      preload="metadata"
      aria-label="Démonstration du tableau de bord Priimo"
    >
      <source src="/Priimo Video.mp4" type="video/mp4" />
    </video>
  );
}

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
              Priimo est le logiciel de prospection prédictive qui repère les signaux publics
              précédant une vente — DPE refait, SCI en dissolution — et vous livre chaque lundi
              les adresses prioritaires de votre secteur.
            </p>

            <ul className="mt-4 flex flex-col items-center gap-2.5 sm:mt-5 lg:flex-row lg:flex-wrap lg:justify-center lg:gap-x-6 lg:gap-y-2 xl:gap-x-8">
              {BULLETS.map(({ text, Icon }, i) => (
                <Reveal
                  as="li"
                  key={text}
                  direction="up"
                  delay={80 + i * 90}
                  className="flex items-center gap-2"
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent-dark"
                    aria-hidden
                  >
                    <Icon size={11} strokeWidth={2.25} />
                  </span>
                  <span className="text-left text-[12.5px] leading-snug text-gray-600 sm:text-[13px]">
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
      <div className="relative mx-auto mt-6 min-w-0 w-full max-w-4xl px-3 sm:mt-8 sm:max-w-5xl sm:px-5 lg:max-w-[1180px]">
        <Reveal direction="up" delay={150}>
          <p className="mx-auto mb-3 max-w-xl px-1 text-center text-[12.5px] leading-snug text-gray-500 sm:mb-4 sm:text-[13px]">
            Voici ce que reçoit une agence chaque lundi.
          </p>
        </Reveal>

        <Reveal direction="scale" delay={180}>
          <div className="relative mx-auto w-full min-w-0 overflow-hidden rounded-[20px] bg-white shadow-[0_40px_100px_-36px_rgba(30,27,75,0.36)] ring-1 ring-black/[0.06] sm:rounded-[24px]">
            <HeroVideo />
          </div>
        </Reveal>

        <Reveal direction="up" delay={220} className="mt-6 flex justify-center sm:mt-8">
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost px-5 py-2.5 text-sm"
          >
            Réserver une démo
            <span data-arrow aria-hidden>
              →
            </span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
