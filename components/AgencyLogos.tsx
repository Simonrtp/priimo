"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Agence = {
  name: string;
  src: string;
  /** Largeur visuelle relative dans la rangée (object-contain). */
  width: number;
  /** Logo blanc sur fond noir → invert pour écriture noire. */
  invert?: boolean;
};

/** Versions couleur — grisées en CSS, puis révélées au scroll. */
const AGENCES: Agence[] = [
  { name: "Century 21", src: "/c21c.png", width: 148 },
  { name: "Swixim", src: "/swixx.png", width: 148 },
  /** Blanc sur noir → inversé en CSS pour écriture noire sur fond clair. */
  { name: "Leman Property", src: "/lempropt.png", width: 132, invert: true },
  { name: "Optimhome", src: "/optiorange.png", width: 148 },
];

// === AGENCY LOGOS ===
// Preuve sociale sous le hero : logos grisés → couleurs au scroll.

export default function AgencyLogos() {
  const rootRef = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setRevealed(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.4, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={rootRef}
      className={`agency-logos${revealed ? " is-revealed" : ""}`}
      aria-label="Agences qui utilisent Priimo"
    >
      <div className="agency-logos-inner">
        <p className="agency-logos-label">Ils utilisent Priimo</p>
        <ul className="agency-logos-row">
          {AGENCES.map((agence, i) => (
            <li
              key={agence.name}
              className={`agency-logo-item${agence.invert ? " is-invert" : ""}`}
              style={{ transitionDelay: revealed ? `${i * 90}ms` : "0ms" }}
            >
              <Image
                src={agence.src}
                alt={agence.name}
                width={agence.width}
                height={44}
                className="agency-logo-img"
                sizes="160px"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
