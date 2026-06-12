"use client";

import { useEffect, useState } from "react";
import Reveal from "./Reveal";
import CtaButton from "./CtaButton";
import { useTiltCard } from "@/lib/use-tilt-card";

// === HOW IT WORKS (Section D) ===
// Desktop (md+): sticky scroll-jacking — cards 01 → 02 → 03 while pinned.
// Mobile: normal flow — all cards visible (no h-screen trap), same content.

type Step = {
  num: string;
  title: string;
  body: string;
  Icon: () => React.JSX.Element;
};

function MapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="3" />
      <circle cx="18" cy="5" r="3" />
      <path d="M6 16V8a4 4 0 0 1 4-4h4" />
      <path d="M18 8v8a4 4 0 0 1-4 4h-4" />
    </svg>
  );
}

const STEPS: Step[] = [
  {
    num: "01",
    title: "Réservez votre secteur",
    body: "Votre zone est exclusive : une seule agence par secteur. Nous la délimitons ensemble lors d'un appel de 20 minutes.",
    Icon: MapIcon,
  },
  {
    num: "02",
    title: "Recevez votre liste du lundi",
    body: "Chaque lundi, les nouvelles adresses scorées arrivent dans votre tableau de bord, avec les signaux — dont les événements de vie sur le bien — qui expliquent chaque score.",
    Icon: ListIcon,
  },
  {
    num: "03",
    title: "Envoyez vos agents au bon endroit",
    body: "Chaque adresse part avec son contexte : signaux, copropriété, historique du bien. Export CSV ou lien Google Maps pour le terrain.",
    Icon: RouteIcon,
  },
];

const MD_QUERY = "(min-width: 768px)";

function StepCard({
  step,
  isCurrent,
  isFuture,
}: {
  step: Step;
  isCurrent: boolean;
  isFuture: boolean;
}) {
  const tiltRef = useTiltCard(7);

  const wrapperClass = isFuture
    ? "opacity-0 translate-y-10 scale-95 max-md:opacity-100 max-md:translate-y-0 max-md:scale-100"
    : "opacity-100 translate-y-0 scale-100";

  const cardClass = isFuture
    ? "shadow-none border-black/5 max-md:shadow-md max-md:border-black/10"
    : isCurrent
      ? "shadow-xl border-accent/30"
      : "shadow-md border-black/10";

  return (
    <div
      className={`transform-gpu transition-all duration-700 ease-out min-w-0 h-full ${wrapperClass}`}
    >
      <div
        ref={tiltRef}
        className={`tilt-card rounded-2xl bg-white border p-5 sm:p-7 h-full ${cardClass}`}
      >
        <div className="font-sans text-5xl sm:text-6xl md:text-7xl text-blue leading-none font-bold">
          {step.num}
        </div>
        <div className="mt-4 sm:mt-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent-dark">
          <step.Icon />
        </div>
        <h3 className="text-h3 text-balance mt-3 sm:mt-4">{step.title}</h3>
        <p className="text-body mt-2">{step.body}</p>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  /** null = SSR / first paint — use mobile-safe layout until we know the viewport */
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  // Track viewport — scroll-jacking only makes sense when 3 columns fit.
  useEffect(() => {
    const mq = window.matchMedia(MD_QUERY);
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const desktop = isDesktop === true;

  useEffect(() => {
    if (!desktop) return;

    let rafId = 0;
    let ticking = false;

    const update = () => {
      const section = document.getElementById("how-it-works");
      if (!section) {
        ticking = false;
        return;
      }

      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;

      const totalScroll = Math.max(rect.height - vh, 1);
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / totalScroll));

      const step = progress < 0.34 ? 0 : progress < 0.67 ? 1 : 2;
      setActiveStep(step);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        rafId = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [desktop]);

  const stepForCard = desktop ? activeStep : 2;

  return (
    <section
      id="how-it-works"
      className={desktop ? "relative min-h-[260vh]" : "relative py-14 sm:py-20"}
    >
      <div
        className={
          desktop
            ? "sticky top-0 min-h-0 h-[100dvh] flex items-center"
            : "relative"
        }
      >
        <div className="w-full mx-auto max-w-6xl px-4 sm:px-8 py-6 sm:py-10 min-w-0">
          <Reveal direction="up">
            <h2 className="text-h2 text-center max-w-3xl mx-auto text-balance px-1 mb-subheading">
              De votre secteur au terrain, en trois étapes.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mt-8 sm:mt-10 lg:mt-14 [perspective:1200px]">
            {STEPS.map((step, i) => (
              <StepCard
                key={step.num}
                step={step}
                isCurrent={i === stepForCard}
                isFuture={i > stepForCard}
              />
            ))}
          </div>

          <Reveal direction="scale" delay={250} className="mt-8 lg:mt-10 flex justify-center px-1">
            <CtaButton className="max-w-full">
              Réserver une démo
              <span aria-hidden>→</span>
            </CtaButton>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
