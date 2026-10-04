"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Bleu sur le bloc prix : entre tôt, et reste longtemps pendant le scroll
 * (cartes + CTA), avant de repasser au blanc.
 */
function shouldFlipDark(offres: HTMLElement): boolean {
  const grid = offres.querySelector<HTMLElement>(".offres-simples-grid");
  const rect = (grid ?? offres).getBoundingClientRect();
  const section = offres.getBoundingClientRect();
  const vh = window.innerHeight || 1;
  // Les cartes approchent déjà du milieu de l’écran.
  const entered = rect.top < vh * 0.78;
  // Le haut des cartes peut monter presque sous le header sans couper le bleu.
  const stillFramed = rect.top > vh * 0.04;
  // Tant qu’une bonne part de la section prix (CTA compris) reste visible.
  const stillInView = section.bottom > vh * 0.22;
  return entered && stillFramed && stillInView;
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
