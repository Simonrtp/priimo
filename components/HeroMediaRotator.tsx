"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Slide = {
  src: string;
  alt: string;
  /** Position object-cover pour cadrer le sujet. */
  objectPosition: string;
};

const SLIDES: Slide[] = [
  {
    src: "/image carte hero.jpg",
    alt: "Aperçu de Priimo : carte de prospection sur ordinateur",
    objectPosition: "72% 50%",
  },
  {
    src: "/image téléphone.jpg",
    alt: "Aperçu de Priimo : application mobile sur téléphone",
    objectPosition: "50% 50%",
  },
];

/** Temps d’affichage d’une image (hors transition). */
const INTERVALLE_MS = 4200;
/** Doit coller à la durée CSS de la transition. */
const TRANSITION_MS = 780;

export default function HeroMediaRotator() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [enVue, setEnVue] = useState(true);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setEnVue(entry.isIntersecting),
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotionRef.current = mq.matches;
    const onChange = () => {
      reduceMotionRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!enVue) return;
    if (reduceMotionRef.current) return;

    const id = window.setInterval(() => {
      setIndex((prev) => {
        setLeaving(prev);
        return (prev + 1) % SLIDES.length;
      });
    }, INTERVALLE_MS);

    return () => window.clearInterval(id);
  }, [enVue]);

  useEffect(() => {
    if (leaving === null) return;
    const id = window.setTimeout(() => setLeaving(null), TRANSITION_MS);
    return () => window.clearTimeout(id);
  }, [leaving]);

  return (
    <div
      ref={rootRef}
      className="landing-hero-media relative aspect-[3/2] w-full min-w-0 overflow-hidden"
      aria-roledescription="carousel"
      aria-label="Aperçus produit Priimo"
    >
      {SLIDES.map((slide, i) => {
        const isActive = i === index;
        const isLeaving = i === leaving;
        return (
          <div
            key={slide.src}
            className={`landing-hero-slide${isActive ? " is-active" : ""}${
              isLeaving ? " is-leaving" : ""
            }`}
            aria-hidden={!isActive}
          >
            <Image
              src={slide.src}
              alt={isActive ? slide.alt : ""}
              fill
              priority={i === 0}
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="object-cover"
              style={{ objectPosition: slide.objectPosition }}
            />
          </div>
        );
      })}
    </div>
  );
}
