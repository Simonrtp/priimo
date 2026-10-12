import { FONCTIONNALITES, type FonctionnaliteCarte } from "@/lib/landing/fonctionnalites";

/** Segment d’URL `/fonctionnalites/{segment}` → slug carte accueil. */
export const SEGMENT_FONCTIONNALITE: Record<string, string> = {
  detection: "prospection",
  terrain: "dictee",
  estimation: "estimations",
  pipeline: "diffusion",
  pilotage: "pilotage",
};

export type SegmentFonctionnalite = keyof typeof SEGMENT_FONCTIONNALITE;

export function carteFonctionnaliteParSegment(
  segment: SegmentFonctionnalite,
): FonctionnaliteCarte | undefined {
  const slug = SEGMENT_FONCTIONNALITE[segment];
  return FONCTIONNALITES.find((c) => c.slug === slug);
}

const SLUG_VERS_SEGMENT = Object.fromEntries(
  Object.entries(SEGMENT_FONCTIONNALITE).map(([segment, slug]) => [slug, segment]),
) as Record<string, SegmentFonctionnalite>;

/** Lien page dédiée pour une carte accueil (slug `prospection`, `dictee`, …). */
export function hrefFonctionnaliteParSlug(slug: string): string {
  const segment = SLUG_VERS_SEGMENT[slug];
  return segment ? `/fonctionnalites/${segment}` : "/";
}
