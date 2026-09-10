/**
 * Palette des zones — huit tons désaturés, et rien d'autre.
 *
 * Deux contraintes non négociables :
 *   * l'orange lead #E8743C n'en fait pas partie, ni aucune teinte voisine :
 *     sur la carte, un contour de zone ne doit jamais se confondre avec un
 *     point de lead ;
 *   * les huit teintes sont écartées entre elles, parce qu'un directeur doit
 *     reconnaître le secteur d'un collaborateur au coup d'œil, y compris en
 *     remplissage translucide à 12 %.
 *
 * Elles sont volontairement peu saturées : un aplat vif sur un fond de carte
 * mange les libellés de rue.
 */

export const COULEURS_ZONE = [
  '#A89A4F', // olive doré
  '#849A55', // vert olive
  '#5E8C6A', // vert sauge
  '#4F8F8B', // canard
  '#4C7A9E', // bleu ardoise
  '#6C74A8', // bleu-violet
  '#8A6FA8', // violet fumé
  '#A0679B', // prune poudrée
] as const;

export type CouleurZone = (typeof COULEURS_ZONE)[number];

/** Opacité du remplissage d'une zone sur la carte. Le contour reste plein. */
export const OPACITE_REMPLISSAGE_ZONE = 0.12;

/**
 * Teinte proposée pour une nouvelle zone : la première de la palette encore
 * libre, sinon on recycle dans l'ordre. Deux zones de même couleur restent
 * possibles — au-delà de huit secteurs, la couleur n'est plus le repère.
 */
export function couleurZoneLibre(prises: readonly string[]): CouleurZone {
  const utilisees = new Set(prises.map((c) => c.toUpperCase()));
  const libre = COULEURS_ZONE.find((c) => !utilisees.has(c.toUpperCase()));
  return libre ?? COULEURS_ZONE[prises.length % COULEURS_ZONE.length]!;
}

export function estCouleurZone(couleur: string): boolean {
  return COULEURS_ZONE.some((c) => c.toUpperCase() === couleur.toUpperCase());
}

/** `#4C7A9E` + 0.12 → `rgba(76,122,158,0.12)`, pour les couches Mapbox. */
export function couleurZoneAvecOpacite(couleur: string, opacite: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(couleur.trim());
  if (!m) return couleur;
  const n = Number.parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${opacite})`;
}
