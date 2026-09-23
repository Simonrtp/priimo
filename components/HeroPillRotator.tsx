"use client";

import { useEffect, useRef, useState } from "react";
import {
  Compass,
  Database,
  MapPinned,
  type LucideIcon,
} from "lucide-react";

type Terme = {
  label: string;
  Icon: LucideIcon;
  color: string;
};

const TERMES: Terme[] = [
  { label: "la prospection", Icon: MapPinned, color: "#5DC47C" },
  { label: "le terrain", Icon: Compass, color: "#E8743C" },
  { label: "la data", Icon: Database, color: "#6366F1" },
];

const INTERVALLE_MS = 1400;

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
          <Icon className="hero-pill-icon" strokeWidth={2.4} />
          {label}
        </span>
      ))}
    </span>
  );
}
