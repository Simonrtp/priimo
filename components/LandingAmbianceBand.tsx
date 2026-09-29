"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Bleu tant que le milieu de la section prix est dans la zone centrale.
 * En sortant (haut ou bas), retour au blanc — au-dessus et en dessous ensemble.
 */
function shouldFlipDark(offres: HTMLElement): boolean {
  const rect = offres.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  const mid = rect.top + rect.height / 2;
  const stillInPlay = rect.bottom > vh * 0.12 && rect.top < vh * 0.92;
  if (!stillInPlay) return false;
  return mid <= vh * 0.72;
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
