import type { CSSProperties } from "react";

/** Juste à l’extérieur du cadre : haut-gauche, haut-droite, bas-droite. */
const SPARKS = [
  {
    dx: "calc(-50cqw - 10px)",
    dy: "calc(-50cqh - 8px)",
    size: 22,
    delay: "0ms",
    drift: "spark-drift-a",
    color: "#9DD6C8",
  },
  {
    dx: "calc(50cqw + 10px)",
    dy: "calc(-50cqh - 10px)",
    size: 24,
    delay: "70ms",
    drift: "spark-drift-b",
    color: "#B8B4E8",
  },
  {
    dx: "calc(50cqw + 10px)",
    dy: "calc(50cqh + 8px)",
    size: 20,
    delay: "120ms",
    drift: "spark-drift-c",
    color: "#8EC5E0",
  },
] as const;

function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0c.35 3.55 1.72 5.65 8 8-6.28 2.35-7.65 4.45-8 8-.35-3.55-1.72-5.65-8-8C6.28 5.65 7.65 3.55 8 0Z" />
    </svg>
  );
}

export default function CtaSparkles() {
  return (
    <span className="cta-sparkles" aria-hidden>
      {SPARKS.map((spark, i) => (
        <span
          key={i}
          className="cta-sparkle"
          style={
            {
              "--spark-size": `${spark.size}px`,
              "--spark-color": spark.color,
              "--dx": spark.dx,
              "--dy": spark.dy,
              "--spark-delay": spark.delay,
              "--spark-drift": spark.drift,
            } as CSSProperties
          }
        >
          <SparkIcon />
        </span>
      ))}
    </span>
  );
}
