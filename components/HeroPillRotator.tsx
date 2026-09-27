"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Terme = {
  label: string;
  color: string;
};

const TERMES: Terme[] = [
  { label: "la prospection", color: "#5DC47C" },
  { label: "le terrain", color: "#38BDF8" },
  { label: "la data", color: "#6366F1" },
];

/** Temps d’affichage d’un terme (hors transition). */
const INTERVALLE_MS = 2400;
/** Doit coller à la durée CSS de la transition. */
const TRANSITION_MS = 620;

export default function HeroPillRotator() {
  const rootRef = useRef<HTMLSpanElement>(null);
  const pillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [enVue, setEnVue] = useState(true);
  const [widthPx, setWidthPx] = useState<number | undefined>(undefined);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setEnVue(entry.isIntersecting),
      { threshold: 0.2 },
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

  useLayoutEffect(() => {
    const measure = () => {
      // Largeur = max des capsules, plafonnée à la place dispo (évite le clip mobile).
      let max = 0;
      for (const el of pillRefs.current) {
        if (!el) continue;
        max = Math.max(max, el.scrollWidth, el.offsetWidth);
      }
      if (max <= 0) return;
      const available = rootRef.current?.parentElement?.clientWidth;
      setWidthPx(available != null ? Math.min(max, available) : max);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [index]);

  useEffect(() => {
    if (!enVue) return;
    if (reduceMotionRef.current) return;

    const id = window.setInterval(() => {
      setIndex((prev) => {
        setLeaving(prev);
        return (prev + 1) % TERMES.length;
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
    <span
      ref={rootRef}
      className="hero-pill-rotator"
      aria-hidden="true"
      style={widthPx != null ? { width: widthPx } : undefined}
    >
      {TERMES.map(({ label, color }, i) => {
        const isActive = i === index;
        const isLeaving = i === leaving;
        return (
          <span
            key={label}
            ref={(node) => {
              pillRefs.current[i] = node;
            }}
            className={`hero-pill${isActive ? " is-active" : ""}${
              isLeaving ? " is-leaving" : ""
            }`}
            style={{ backgroundColor: color }}
          >
            {label}
          </span>
        );
      })}
    </span>
  );
}
