"use client";

import { useEffect, useRef } from "react";

/** Capsule fine à droite, suit le défilement. */
export default function ScrollLine() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let hideTimer = 0;

    const place = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.setProperty("--scroll-p", p.toFixed(4));
      return p;
    };

    const toneDerriere = (p: number) => {
      const rail = el.getBoundingClientRect();
      const top = rail.top + p * Math.max(0, rail.height - 44);
      const capsule = { top, bottom: top + 44 };
      const zones = document.querySelectorAll(
        ".landing-hero, .problem-transform, .landing-ambiance-band[data-ambiance='dark'], main > section.bg-gradient-to-br",
      );
      for (const zone of zones) {
        const rect = zone.getBoundingClientRect();
        if (capsule.bottom > rect.top && capsule.top < rect.bottom) return "light";
      }
      return "dark";
    };

    const apply = () => {
      raf = 0;
      const p = place();
      el.dataset.tone = toneDerriere(p);
      el.dataset.scrolling = "true";
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        el.dataset.scrolling = "false";
      }, 650);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };

    place();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", place, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(hideTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", place);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="scroll-line"
      data-scrolling="false"
      data-tone="dark"
      aria-hidden
    >
      <span />
    </div>
  );
}
