import type { CSSProperties } from "react";

/** Hors du bouton + marge pour la taille et le drift — jamais coupées par le masque. */
/** Positions en CSS (--dx / --dy) — voir globals.css ; pas de cqw (masque les étincelles si le conteneur n’a pas de taille). */
const SPARKS = [
  {
    size: 22,
    delay: "0ms",
    drift: "spark-drift-a",
    color: "#9DD6C8",
  },
  {
    size: 24,
    delay: "70ms",
    drift: "spark-drift-b",
    color: "#B8B4E8",
  },
  {
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
