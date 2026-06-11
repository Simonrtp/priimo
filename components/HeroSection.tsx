"use client";

import Link from "next/link";
import Reveal from "./Reveal";
import DashboardMockup from "./DashboardMockup";
import HeroBackground from "./HeroBackground";
import { CALENDLY_URL } from "@/lib/calendly";

// === HERO SECTION ===
// Above-the-fold. Animated mouse-reactive background, H1 → subheadline →
// bullets → primary CTA. Two-column layout on desktop.

const BULLETS = [
  "Une liste courte, scorée et priorisée — la qualité, jamais de volume",
  "Secteur exclusif : une seule agence par zone",
  "100 % données publiques en France, conforme post-interdiction de la pige (2025)",
];

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function HeroSection() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden pt-28 sm:pt-32 pb-16 sm:pb-24"
    >
      {/* Animated, mouse-reactive background */}
      <HeroBackground />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 min-w-0">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center min-w-0">
          {/* === LEFT — Copy + CTA === */}
          <div className="lg:col-span-7 min-w-0">
            <Reveal direction="up">
              {/* H1 */}
              <h1 className="text-h1 headline text-balance mb-headline">
                Arrêtez de chasser les vendeurs. Recevez leurs adresses chaque lundi.
              </h1>

              {/* Subheadline */}
              <p className="text-body max-w-xl mb-body mt-0">
                Priimo est le logiciel de prospection prédictive qui lit les signaux publics
                précédant une vente : événements de vie sur le bien, DPE refait, ventes en série
                dans l&apos;immeuble, copropriété qui décroche. Chaque lundi, il vous livre les
                adresses prioritaires de votre secteur.
              </p>

              {/* Bullets */}
              <ul className="mt-6 space-y-2.5">
                {BULLETS.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-gray-900">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-dark">
                      <CheckIcon />
                    </span>
                    <span className="text-body !text-gray-900">{b}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* Primary CTA — Calendly (réservation de démo) */}
            <Reveal direction="up" delay={120} className="mt-8">
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary px-7 py-4 text-base"
              >
                Réserver une démo
                <span aria-hidden>→</span>
              </a>
              <p className="mt-4 small-text !normal-case !tracking-normal text-gray-600">
                Déjà client ?{" "}
                <Link
                  href="/login"
                  className="text-accent-dark font-medium hover:underline"
                >
                  Se connecter
                </Link>
              </p>
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
