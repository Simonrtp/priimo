import {
  HERO_TITRE_PAR_SLUG,
  couleurTextePastille,
} from "@/lib/landing/fonctionnalite-hero-titres";
import type { CSSProperties } from "react";

type Props = {
  slug: string;
  titreFallback: string;
  couleurIcone: string;
};

/** H1 avec pastilles — pages dédiées uniquement (pas l’accueil). */
export default function FonctionnalitePageTitre({
  slug,
  titreFallback,
  couleurIcone,
}: Props) {
  const titreSegments =
    HERO_TITRE_PAR_SLUG[slug] ?? [{ kind: "line" as const, text: titreFallback }];
  const pastilleBg = couleurIcone;
  const pastilleFg = couleurTextePastille(pastilleBg);

  return (
    <h1 id="feature-tiime-title" className="feature-tiime-title">
      {titreSegments.map((seg) => {
        if (seg.kind === "line") {
          return (
            <span key={seg.text} className="feature-tiime-title-line">
              {seg.text}
            </span>
          );
        }
        return (
          <span
            key={`${seg.before}${seg.mot}${seg.after}`}
            className="feature-tiime-title-line"
          >
            {seg.before}
            <span
              className="feature-tiime-capsule"
              style={
                {
                  "--feature-capsule-bg": pastilleBg,
                  "--feature-capsule-fg": pastilleFg,
                } as CSSProperties
              }
            >
              {seg.mot}
            </span>
            {seg.after}
          </span>
        );
      })}
    </h1>
  );
}
