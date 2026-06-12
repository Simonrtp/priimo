"use client";

import { useEffect, useRef } from "react";

/** Courbe douce : réponse linéaire au centre, saturation progressive aux bords. */
function softTiltAxis(normalized: number, maxDeg: number): number {
  const t = normalized * 2;
  return Math.tanh(t * 1.4) * maxDeg;
}

/** Tilt 3D au survol : rotateX / rotateY selon la position de la souris. */
export function useTiltCard(maxDeg = 7) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduced || coarse) return;

    const target = { rx: 0, ry: 0 };
    const current = { rx: 0, ry: 0 };
    let hovering = false;
    let rafId = 0;

    const paint = () => {
      el.style.transform = [
        "perspective(900px)",
        `rotateX(${current.rx.toFixed(2)}deg)`,
        `rotateY(${current.ry.toFixed(2)}deg)`,
      ].join(" ");
    };

    const updateTarget = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      target.ry = softTiltAxis(px, maxDeg);
      target.rx = -softTiltAxis(py, maxDeg);
    };

    const onEnter = (e: PointerEvent) => {
      hovering = true;
      el.classList.remove("tilt-card--reset");
      updateTarget(e);
    };

    const onMove = (e: PointerEvent) => {
      updateTarget(e);
    };

    const onLeave = () => {
      hovering = false;
      target.rx = 0;
      target.ry = 0;
    };

    const tick = () => {
      const factor = hovering ? 0.14 : 0.11;
      current.rx += (target.rx - current.rx) * factor;
      current.ry += (target.ry - current.ry) * factor;

      if (
        !hovering &&
        Math.abs(current.rx) < 0.04 &&
        Math.abs(current.ry) < 0.04
      ) {
        current.rx = 0;
        current.ry = 0;
        el.classList.add("tilt-card--reset");
      }

      paint();
      rafId = requestAnimationFrame(tick);
    };

    paint();
    tick();

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointermove", onMove);

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointermove", onMove);
      el.style.transform = "";
      el.classList.remove("tilt-card--reset");
    };
  }, [maxDeg]);

  return ref;
}
