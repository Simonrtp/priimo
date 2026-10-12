/**
 * Lignes du hero type Tiime (pages /fonctionnalites/* uniquement).
 * L’accueil (LogicielOnglets) affiche `FONCTIONNALITES[].titre` sans pastille.
 */
export type HeroTitreSegment =
  | { kind: "line"; text: string }
  | { kind: "line-capsule"; before: string; mot: string; after: string };

export const HERO_TITRE_PAR_SLUG: Record<string, HeroTitreSegment[]> = {
  prospection: [
    { kind: "line", text: "La pige est terminée." },
    { kind: "line-capsule", before: "Le ", mot: "terrain", after: " reprend." },
  ],
  dictee: [
    { kind: "line-capsule", before: "Le CRM qui se remplit ", mot: "en marchant", after: "" },
  ],
  estimations: [
    { kind: "line", text: "Un avis de valeur" },
    {
      kind: "line-capsule",
      before: "",
      mot: "prêt",
      after: " avant de quitter le salon",
    },
  ],
  diffusion: [
    { kind: "line", text: "Un mandat saisi une fois," },
    { kind: "line-capsule", before: "", mot: "publié partout", after: "" },
  ],
  pilotage: [
    { kind: "line-capsule", before: "Un ", mot: "coach", after: ", pas un tableau de bord" },
  ],
};

/** Texte dans la pastille — blanc par défaut (charte accueil), sauf fonds quasi blancs. */
export function couleurTextePastille(couleurFond: string): string {
  const normalized = couleurFond.trim().toLowerCase();
  if (normalized === "#ffd400") return "#fff";
  const hex = normalized.replace("#", "");
  if (hex.length !== 6) return "#fff";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.72 ? "#1a2a56" : "#fff";
}
