"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Bleu seulement tant que les cartes prix sont cadrées dans l’écran.
 * Un petit scroll (le haut des cartes rejoint le header) → retour au blanc.
 */
function shouldFlipDark(offres: HTMLElement): boolean {
  const target = offres.querySelector<HTMLElement>(".offres-simples-grid") ?? offres;
  const rect = target.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  const entered = rect.top < vh * 0.58;
  const stillFramed = rect.top > vh * 0.22;
  const stillAboveFold = rect.bottom > vh * 0.42;
  return entered && stillFramed && stillAboveFold;
}

export default function LandingAmbianceBand({ children }: { children: ReactNode }) {
  const bandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;

    const offres = band.querySelector<HTMLElement>(".offres-simples");
    if (!offres) return;

    let raf = 0;
    let dark = false;

    const apply = () => {
      raf = 0;
      const next = shouldFlipDark(offres);
      if (next === dark) return;
      dark = next;
      band.dataset.ambiance = dark ? "dark" : "light";
      document.documentElement.dataset.landingAmbiance = dark ? "dark" : "light";
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };

    band.dataset.ambiance = "light";
    document.documentElement.dataset.landingAmbiance = "light";
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      delete document.documentElement.dataset.landingAmbiance;
    };
  }, []);

  return (
    <div ref={bandRef} className="landing-ambiance-band" data-ambiance="light">
      {children}
    </div>
  );
}
