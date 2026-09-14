"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapPinned,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Terme = {
  label: string;
  Icon: LucideIcon;
  color: string;
};

const TERMES: Terme[] = [
  { label: "chiffre d'affaires", Icon: TrendingUp, color: "#6366F1" },
  { label: "productivité", Icon: Zap, color: "#E05C5C" },
  { label: "prospection", Icon: MapPinned, color: "#16A34A" },
];

const INTERVALLE_MS = 2800;

export default function HeroPillRotator() {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [index, setIndex] = useState(0);
  const [enVue, setEnVue] = useState(true);

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
    if (!enVue) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % TERMES.length);
    }, INTERVALLE_MS);
    return () => window.clearInterval(id);
  }, [enVue]);

  return (
    <span ref={rootRef} className="hero-pill-rotator" aria-hidden="true">
      {TERMES.map(({ label, Icon, color }, i) => (
        <span
          key={label}
          className={`hero-pill${i === index ? " is-active" : ""}`}
          style={{ backgroundColor: color }}
        >
          <Icon className="hero-pill-icon" aria-hidden />
          {label}
        </span>
      ))}
    </span>
  );
}
