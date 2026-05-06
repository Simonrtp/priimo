"use client";

import Reveal from "./Reveal";
import BetaForm from "./BetaForm";
import DashboardMockup from "./DashboardMockup";
import HeroBackground from "./HeroBackground";

// === HERO SECTION ===
// Above-the-fold. Animated mouse-reactive background, eyebrow → H1 →
// subheadline → 3 bullets → inline form. Two-column layout on desktop.

const BULLETS = [
  "Prospects scorés et priorisés sur votre zone",
  "Opérationnel en 20 minutes, sans formation",
  "Conforme post-interdiction pige téléphonique",
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

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* === LEFT — Copy + Form === */}
          <div className="lg:col-span-7">
            <Reveal direction="up">
              {/* Eyebrow — orange dot + slate-blue text for warm/cool mix */}
              <div className="inline-flex items-center gap-2 rounded-full border border-blue/20 bg-white/80 backdrop-blur px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-blue-dark">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                Logiciel de prospection immobilière · Bêta privée ouverte
              </div>

              {/* H1 */}
              <h1 className="font-display mt-5 text-4xl sm:text-5xl lg:text-6xl text-ink leading-[1.05] font-extrabold">
                Trouvez vos prochains mandats avant vos concurrents.
              </h1>

              {/* Subheadline */}
              <p className="mt-5 text-lg text-mute max-w-xl leading-relaxed">
                Priimo croise les données DVF, DPE et signaux de vie pour
                identifier les propriétaires susceptibles de vendre — et dit
                à vos agents exactement où aller cette semaine.
              </p>

              {/* Bullets */}
              <ul className="mt-6 space-y-2.5">
                {BULLETS.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-ink">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-dark">
                      <CheckIcon />
                    </span>
                    <span className="text-[15px]">{b}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* Inline form */}
            <Reveal direction="up" delay={120} className="mt-8 max-w-md">
              <BetaForm id="beta-form" />
              <p className="mt-3 text-xs text-mute">
                Accès gratuit pendant la bêta · Aucune carte bancaire requise ·{" "}
                <span className="text-ink font-medium">
                  47 agences déjà sur liste d&apos;attente
                </span>
              </p>
            </Reveal>

            {/* Social proof */}
            <Reveal direction="fade" delay={250} className="mt-8 flex items-center gap-2 text-sm text-mute">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-soft-warm text-[10px]" aria-hidden>
                🇫🇷
              </span>
              Conçu avec des directeurs d&apos;agences immobilières en France.
            </Reveal>
          </div>

          {/* === RIGHT — Product visual === */}
          <div className="lg:col-span-5">
            <Reveal direction="scale" delay={150}>
              <DashboardMockup />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
