// === REVEAL ===
// Apparition au scroll via CSS scroll-driven animations (pas de JS / IO).
"use client";

type Direction = "up" | "down" | "left" | "right" | "scale" | "fade";

type Props = {
  children: React.ReactNode;
  direction?: Direction;
  delay?: number;
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
  const Component = Tag as React.ElementType;
  return (
    <Component
      className={`reveal ${DIRECTION_CLASS[direction]} ${className}`}
      style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Component>
  );
}
