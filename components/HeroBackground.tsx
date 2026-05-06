"use client";

import { useEffect, useRef } from "react";

// === HERO BACKGROUND ===
// Animated, mouse-reactive backdrop for the hero section.
//
// How it works:
//  - The component renders an absolutely positioned <div class="hero-bg">
//    inside the hero <section>. Its parent is the section.
//  - We listen to `pointermove` on that section. The cursor's relative
//    position is converted to percentages and stored in a `target` ref.
//  - A requestAnimationFrame loop interpolates `current` toward `target`
//    (lerp factor 0.08) and writes the result to the `--mx`/`--my`
//    CSS variables on the .hero-bg element.
//  - The CSS in globals.css uses those variables in radial gradients,
//    creating a soft "spotlight" that follows the cursor smoothly.
//  - The component is `pointer-events: none` so it never intercepts
//    clicks/scrolls.
//  - prefers-reduced-motion users see a static background (no rAF loop).

export default function HeroBackground() {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bg = bgRef.current;
    if (!bg) return;

    // Find the closest <section> ancestor — that's our event surface.
    const surface = bg.closest("section") as HTMLElement | null;
    if (!surface) return;

    // Respect prefers-reduced-motion: keep the gradient static.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      bg.style.setProperty("--mx", "50%");
      bg.style.setProperty("--my", "35%");
      return;
    }

    // Initial position — slightly above center for a pleasing default.
    const target = { x: 50, y: 35 };
    const current = { x: 50, y: 35 };
    let rafId = 0;

    const onMove = (e: PointerEvent) => {
      const rect = surface.getBoundingClientRect();
      target.x = ((e.clientX - rect.left) / rect.width) * 100;
      target.y = ((e.clientY - rect.top) / rect.height) * 100;
    };

    const onLeave = () => {
      // Drift back toward the default focal point.
      target.x = 50;
      target.y = 35;
    };

    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerleave", onLeave);

    const tick = () => {
      // Smooth lerp toward target — feels softer than direct tracking.
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      bg.style.setProperty("--mx", `${current.x.toFixed(2)}%`);
      bg.style.setProperty("--my", `${current.y.toFixed(2)}%`);
      rafId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={bgRef} aria-hidden className="hero-bg">
      {/* Subtle dot grid overlay (CSS-only, masked at edges) */}
      <div className="hero-grid" />
    </div>
  );
}
