/**
 * La « goutte » qui relie la barre de recherche au micro : deux gouttes d'eau
 * qui fusionnent. Le col n'est pas dessiné à la main : une pilule et un cercle
 * très proches, floutés puis re-contrastés (filtre « gooey »), se rejoignent
 * d'eux-mêmes par une courbe lisse, sans angle ni raccord.
 *
 * Repère : origine au bord droit de la pilule, y vers le bas. La forme
 * déborde à gauche sur la pilule (blanc sur blanc) pour ne laisser aucun
 * liseré.
 */

export type GoutteParams = {
  /** Hauteur de la pilule. */
  hauteurPilule: number;
  /** Rayon du cercle blanc qui entoure le micro. */
  rayonCercle: number;
  /** Largeur du bout de pilule dessiné au-delà de la barre. */
  bout: number;
  /** Espace entre ce bout et le cercle : plus il est petit, plus le col est épais. */
  espace: number;
  /** Flou de la fusion : plus il est grand, plus les courbes sont longues. */
  flou: number;
  /** Seuil de contraste (0 à 1) : plus bas, plus le col est charnu. */
  seuil?: number;
};

export type Goutte = {
  largeur: number;
  hauteur: number;
  /** Centre du cercle : le bouton micro s'y pose. */
  cx: number;
  cy: number;
  /** Le bout de pilule : x, y, largeur, hauteur (déborde à gauche). */
  bout: { x: number; y: number; w: number; h: number };
  /** Matrice de contraste du filtre. */
  contraste: { pente: number; decalage: number };
  flou: number;
  /** Zone du filtre : assez grande pour que le flou ne soit pas coupé. */
  zone: { x: number; y: number; w: number; h: number };
};

const DEBORD = 24;
const PENTE = 24;

export function goutte({ hauteurPilule, rayonCercle: R, bout, espace, flou, seuil = 0.5 }: GoutteParams): Goutte {
  const cy = Math.max(R, hauteurPilule / 2);
  const cx = bout + espace + R;
  const marge = Math.ceil(flou * 3);
  return {
    largeur: cx + R,
    hauteur: 2 * cy,
    cx,
    cy,
    bout: { x: -DEBORD, y: cy - hauteurPilule / 2, w: DEBORD + bout, h: hauteurPilule },
    contraste: { pente: PENTE, decalage: -PENTE * seuil },
    flou,
    zone: { x: -DEBORD - marge, y: -marge, w: cx + R + DEBORD + 2 * marge, h: 2 * cy + 2 * marge },
  };
}
