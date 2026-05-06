"use client";

import { useEffect, useRef, useState } from "react";

// === REVEAL ===
// Lightweight scroll-reveal wrapper using IntersectionObserver.
// Adds the `is-visible` class once the element enters the viewport,
// driving the CSS transition defined in globals.css.
//
// Six directions are supported:
//   - "up"    (default) — slides up from below
//   - "down"            — drops down from above
//   - "left"            — slides in from the left
//   - "right"           — slides in from the right
//   - "scale"           — gentle zoom-in (great for cards / mockups)
//   - "fade"            — opacity only

type Direction = "up" | "down" | "left" | "right" | "scale" | "fade";

type Props = {
  children: React.ReactNode;
  /** Direction the element animates from. Default: "up". */
  direction?: Direction;
  /** Delay in ms before applying the reveal — useful for staggered grids. */
  delay?: number;
  /** Override the wrapper element. Default is `div`. */
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
};

const DIRECTION_CLASS: Record<Direction, string> = {
  up: "reveal-up",
  down: "reveal-down",
  left: "reveal-left",
  right: "reveal-right",
  scale: "reveal-scale",
  fade: "reveal-fade",
};

export default function Reveal({
  children,
  direction = "up",
  delay = 0,
  as: Tag = "div",
  className = "",
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }

    let timeoutId: number | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            timeoutId = window.setTimeout(() => setVisible(true), delay);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [delay]);

  const Component = Tag as React.ElementType;
  return (
    <Component
      ref={ref as React.Ref<HTMLElement>}
      className={`reveal ${DIRECTION_CLASS[direction]} ${visible ? "is-visible" : ""} ${className}`}
    >
      {children}
    </Component>
  );
}
