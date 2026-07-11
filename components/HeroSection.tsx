"use client";

import Link from "next/link";
import { ListOrdered, MapPinned, ShieldCheck, type LucideIcon } from "lucide-react";
import Reveal from "./Reveal";
import DashboardMockup from "./DashboardMockup";
import HeroBackground from "./HeroBackground";
import { CALENDLY_URL } from "@/lib/calendly";

// === HERO SECTION ===
// Above-the-fold. Fond réactif à la souris, H1 avec mot-clé en dégradé chaud
// animé, bullets avec icônes, CTA. Le mockup produit flotte à droite.

const BULLETS: { text: string; Icon: LucideIcon }[] = [
  {
    text: "Une liste courte, scorée et priorisée — la qualité, jamais de volume",
    Icon: ListOrdered,
  },
  {
    text: "Secteur exclusif : une seule agence par zone",
    Icon: MapPinned,
  },
  {
    text: "100 % données publiques en France, conforme post-interdiction de la pige (2025)",
    Icon: ShieldCheck,
  },
];

export default function HeroSection() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden pt-28 sm:pt-36 pb-16 sm:pb-28"
    >
      {/* Animated, mouse-reactive background */}
      <HeroBackground />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 min-w-0">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center min-w-0">
          {/* === LEFT — Copy + CTA === */}
          <div className="lg:col-span-7 min-w-0">
            <Reveal direction="up">
              {/* H1 — mot-clé « chaque lundi » en dégradé */}
              <h1 className="text-h1 headline text-balance mb-headline">
                Arrêtez de chasser les vendeurs. Recevez leurs adresses{" "}
                <span className="text-grad">chaque lundi</span>.
              </h1>

              {/* Subheadline */}
              <p className="text-body max-w-xl mb-body mt-0">
                Priimo est le logiciel de prospection prédictive qui lit les signaux publics
                précédant une vente : événements de vie sur le bien, DPE refait, ventes en série
                dans l&apos;immeuble, copropriété qui décroche. Chaque lundi, il vous livre les
                adresses prioritaires de votre secteur.
              </p>

              {/* Bullets */}
              <ul className="mt-7 space-y-3">
                {BULLETS.map(({ text, Icon }, i) => (
                  <Reveal as="li" key={text} direction="up" delay={80 + i * 90}>
                    <div className="flex items-start gap-3 text-gray-900">
                      <span
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white"
                        aria-hidden
                      >
                        <Icon size={13} strokeWidth={2.25} />
                      </span>
                      <span className="text-body !text-gray-900">{text}</span>
                    </div>
                  </Reveal>
                ))}
              </ul>
            </Reveal>

            {/* Primary CTA — Calendly (réservation de démo) */}
            <Reveal direction="up" delay={120} className="mt-9">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary px-7 py-4 text-base"
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

          {/* === RIGHT — Product visual === */}
          <div className="lg:col-span-5 min-w-0 w-full">
            <Reveal direction="scale" delay={150}>
              <DashboardMockup />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
