/**
 * La « goutte » qui relie la barre de recherche au micro : le bord de la
 * pilule s'arrondit au coin, plonge dans un col creusé, puis remonte en
 * cercle autour du micro. Chaque courbe est tangente à la suivante, comme deux
 * gouttes d'eau qui se touchent.
 *
 * Coordonnées de l'image SVG : origine en haut à gauche, y vers le bas. La
 * pilule (côté HTML) s'arrête à `x = recouvrement` ; l'image prend le relais.
 */

export type GoutteParams = {
  /** Hauteur de la pilule. */
  hauteurPilule: number;
  /** Rayon du cercle blanc qui entoure le micro. */
  rayonCercle: number;
  /** Distance entre la fin du bord droit de la pilule et le centre du cercle. */
  ecart: number;
  /** Rayon du coin où le bord de la pilule plonge vers le col. */
  rayonCoin: number;
  /** Rayon des creux du col : plus grand, plus doux. */
  rayonCol: number;
  /** Chevauchement avec la pilule, pour qu'aucun liseré n'apparaisse. */
  recouvrement?: number;
};

export type Goutte = {
  chemin: string;
  largeur: number;
  hauteur: number;
  /** Centre du cercle : le bouton micro s'y pose. */
  cx: number;
  cy: number;
  /** Demi-hauteur du col, au plus étroit. */
  demiCol: number;
};

type Point = { x: number; y: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Point à `rayon` du centre `a`, sur la droite qui va vers `b`. */
function vers(a: Point, b: Point, rayon: number): Point {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: a.x + ((b.x - a.x) * rayon) / d, y: a.y + ((b.y - a.y) * rayon) / d };
}

export function goutte({
  hauteurPilule,
  rayonCercle: R,
  ecart,
  rayonCoin: rho,
  rayonCol: k,
  recouvrement = 2,
}: GoutteParams): Goutte {
  const cy = Math.max(R, hauteurPilule / 2);
  const haut = cy - hauteurPilule / 2;
  const pe = recouvrement;
  const coin: Point = { x: pe, y: haut + rho };
  const cercle: Point = { x: pe + ecart, y: cy };

  // Centre du creux : à rho + k du coin, à R + k du cercle, au-dessus des deux.
  const dx = cercle.x - coin.x;
  const dy = cercle.y - coin.y;
  const d = Math.hypot(dx, dy);
  const a = (d * d + (rho + k) ** 2 - (R + k) ** 2) / (2 * d);
  const h = Math.sqrt(Math.max(0, (rho + k) ** 2 - a * a));
  const px = coin.x + (a * dx) / d;
  const py = coin.y + (a * dy) / d;
  const c1 = { x: px - (h * dy) / d, y: py + (h * dx) / d };
  const c2 = { x: px + (h * dy) / d, y: py - (h * dx) / d };
  const creux = c1.y < c2.y ? c1 : c2;

  // Points de contact : sur le coin, puis sur le cercle.
  const t1 = vers(coin, creux, rho);
  const t2 = vers(cercle, creux, R);
  const bas = (y: number) => 2 * cy - y;
  const p = (pt: Point, miroir = false) => `${r2(pt.x)} ${r2(miroir ? bas(pt.y) : pt.y)}`;

  const chemin = [
    `M0 ${r2(haut)}`,
    `L${r2(pe)} ${r2(haut)}`,
    `A${r2(rho)} ${r2(rho)} 0 0 1 ${p(t1)}`,
    `A${r2(k)} ${r2(k)} 0 0 0 ${p(t2)}`,
    `A${r2(R)} ${r2(R)} 0 1 1 ${p(t2, true)}`,
    `A${r2(k)} ${r2(k)} 0 0 0 ${p(t1, true)}`,
    `A${r2(rho)} ${r2(rho)} 0 0 1 ${r2(pe)} ${r2(bas(haut))}`,
    `L0 ${r2(bas(haut))}`,
    'Z',
  ].join(' ');

  return {
    chemin,
    largeur: r2(cercle.x + R),
    hauteur: r2(2 * cy),
    cx: r2(cercle.x),
    cy: r2(cy),
    demiCol: r2(cy - (creux.y + k)),
  };
}
