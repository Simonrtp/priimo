"use client";

import { useEffect, useState } from "react";
import Reveal from "./Reveal";
import CtaButton from "./CtaButton";

// === HOW IT WORKS (Section D) ===
// Sticky scroll-jacking experience: once the user reaches this section it
// pins to the top of the viewport. Scrolling no longer advances the page —
// it progressively reveals card 01, then 02, then 03 (additive, the
// previous cards stay visible). When all three are revealed the section
// detaches and normal page scrolling resumes.

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
    title: "Définissez votre zone",
    body: "Tracez votre secteur de prospection sur la carte. Priimo analyse automatiquement tous les biens de votre zone.",
    Icon: MapIcon,
  },
  {
    num: "02",
    title: "Recevez votre liste de la semaine",
    body: "Chaque lundi, une liste de prospects scorés apparaît dans votre tableau de bord, avec le signal qui explique le score.",
    Icon: ListIcon,
  },
  {
    num: "03",
    title: "Envoyez vos agents sur le terrain",
    body: "Partagez la carte interactive avec vos agents. Ils savent exactement où aller, dans quel ordre, et pourquoi.",
    Icon: RouteIcon,
  },
];

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
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

      // Standard sticky scroll-jacking progress:
      //   progress = 0 → section top reaches the viewport top (sticky activates)
      //   progress = 1 → section bottom reaches the viewport bottom (sticky releases)
      const totalScroll = Math.max(rect.height - vh, 1);
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / totalScroll));

      // Three equal phases — past cards remain fully visible (additive reveal).
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
  }, []);

  return (
    <section
      id="how-it-works"
      className="relative min-h-[260vh]"
    >
      {/* Sticky stage — pins to the top of the viewport while the user scrolls
          through the section's tall runway, releasing once it ends. */}
      <div className="sticky top-0 h-screen flex items-center">
        <div className="w-full mx-auto max-w-6xl px-5 sm:px-8 py-10">
          <Reveal direction="up">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl text-center text-ink leading-tight max-w-3xl mx-auto font-bold">
              Simple. Précis. Opérationnel en 20 minutes.
            </h2>
          </Reveal>

          {/* Cards revealed sequentially: past cards stay fully visible. */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mt-10 lg:mt-14">
            {STEPS.map((step, i) => {
              const isCurrent = i === activeStep;
              const isFuture = i > activeStep;
              // Future cards are hidden. Past + current cards are fully visible.
              // The most recently revealed (current) card gets a subtle highlight.
              const stateClass = isFuture
                ? "opacity-0 translate-y-10 scale-95 shadow-none border-black/5"
                : isCurrent
                ? "opacity-100 translate-y-0 scale-100 shadow-xl border-accent/30"
                : "opacity-100 translate-y-0 scale-100 shadow-md border-black/10";

              return (
                <div
                  key={step.num}
                  className={`rounded-2xl bg-white border p-6 sm:p-7 h-full transform-gpu transition-all duration-700 ease-out ${stateClass}`}
                >
                  <div className="font-display text-6xl sm:text-7xl text-blue leading-none font-extrabold">
                    {step.num}
                  </div>
                  <div className="mt-5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent-dark">
                    <step.Icon />
                  </div>
                  <h3 className="mt-4 font-display text-xl text-ink font-bold">{step.title}</h3>
                  <p className="mt-2 text-mute leading-relaxed text-[15px]">
                    {step.body}
                  </p>
                </div>
              );
            })}
          </div>

          <Reveal direction="scale" delay={250} className="mt-8 lg:mt-10 flex justify-center">
            <CtaButton>
              Je rejoins la bêta privée
              <span aria-hidden>→</span>
            </CtaButton>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
