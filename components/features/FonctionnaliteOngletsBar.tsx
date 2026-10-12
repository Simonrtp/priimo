"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import { FONCTIONNALITES } from "@/lib/landing/fonctionnalites";
import { hrefFonctionnaliteParSlug } from "@/lib/landing/fonctionnalite-par-chemin";

type Props = {
  activeSlug: string;
};

export default function FonctionnaliteOngletsBar({ activeSlug }: Props) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    function relayerMolette(e: WheelEvent) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const cible = e.currentTarget;
      if (!(cible instanceof Element)) return;
      const overflowX = getComputedStyle(cible).overflowX;
      if (overflowX === "visible" || overflowX === "clip") return;
      e.preventDefault();
      window.scrollBy(0, e.deltaY);
    }

    bar.addEventListener("wheel", relayerMolette, { passive: false });
    return () => bar.removeEventListener("wheel", relayerMolette);
  }, []);

  return (
    <div
      ref={barRef}
      className="logiciel-onglets-bar feature-tiime-onglets-bar"
      aria-label="Fonctionnalités du logiciel"
    >
      {FONCTIONNALITES.map((carte) => {
        const selected = carte.slug === activeSlug;
        const href = hrefFonctionnaliteParSlug(carte.slug);
        const { Icon } = carte;
        return (
          <Link
            key={carte.slug}
            href={href}
            aria-current={selected ? "page" : undefined}
            className={`logiciel-onglet${selected ? " is-active" : ""}`}
            style={{ "--onglet-accent": carte.couleurIcone } as CSSProperties}
          >
            <span className="logiciel-onglet-icon" aria-hidden>
              <Icon strokeWidth={2.25} absoluteStrokeWidth={false} />
            </span>
            <span className="logiciel-onglet-label">{carte.onglet}</span>
            {carte.badge ? (
              <span className="logiciel-onglet-badge">{carte.badge}</span>
            ) : null}
            {carte.bientot ? (
              <span className="logiciel-onglet-badge is-bientot">Bientôt</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
