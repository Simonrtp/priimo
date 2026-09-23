/**
 * Formes prédéfinies pour un secteur : un geste (origine → relâchement)
 * donne un polygone GeoJSON. Les calculs se font à l’écran pour qu’un
 * « rond » reste un rond, pas une ellipse en latitude.
 */

export type PointEcran = { x: number; y: number };
export type VersCarte = (p: PointEcran) => readonly [number, number];

const SEGMENTS_ROND = 32;

function ferme(anneau: readonly (readonly [number, number])[]): GeoJSON.Polygon | null {
  if (anneau.length < 3) return null;
  const premier = anneau[0]!;
  const dernier = anneau[anneau.length - 1]!;
  const ring =
    premier[0] === dernier[0] && premier[1] === dernier[1]
      ? anneau.map((p) => [p[0], p[1]] as [number, number])
      : [...anneau.map((p) => [p[0], p[1]] as [number, number]), [premier[0], premier[1]]];
  if (ring.length < 4) return null;
  return { type: 'Polygon', coordinates: [ring] };
}

/** Rectangle aligné sur l’écran, des deux coins du geste. */
export function polygoneCarre(a: PointEcran, b: PointEcran, versCarte: VersCarte): GeoJSON.Polygon | null {
  const gauche = Math.min(a.x, b.x);
  const droite = Math.max(a.x, b.x);
  const haut = Math.min(a.y, b.y);
  const bas = Math.max(a.y, b.y);
  if (droite - gauche < 4 || bas - haut < 4) return null;
  return ferme([
    versCarte({ x: gauche, y: bas }),
    versCarte({ x: droite, y: bas }),
    versCarte({ x: droite, y: haut }),
    versCarte({ x: gauche, y: haut }),
  ]);
}

/** Disque : centre au premier clic, rayon jusqu’au curseur. */
export function polygoneRond(a: PointEcran, b: PointEcran, versCarte: VersCarte): GeoJSON.Polygon | null {
  const rayon = Math.hypot(b.x - a.x, b.y - a.y);
  if (rayon < 4) return null;
  const anneau: [number, number][] = [];
  for (let i = 0; i < SEGMENTS_ROND; i += 1) {
    const angle = (i / SEGMENTS_ROND) * Math.PI * 2;
    const [lng, lat] = versCarte({
      x: a.x + Math.cos(angle) * rayon,
      y: a.y + Math.sin(angle) * rayon,
    });
    anneau.push([lng, lat]);
  }
  return ferme(anneau);
}

/** Triangle isocèle dans le rectangle du geste, pointe vers le haut de l’écran. */
export function polygoneTriangle(a: PointEcran, b: PointEcran, versCarte: VersCarte): GeoJSON.Polygon | null {
  const gauche = Math.min(a.x, b.x);
  const droite = Math.max(a.x, b.x);
  const haut = Math.min(a.y, b.y);
  const bas = Math.max(a.y, b.y);
  if (droite - gauche < 4 || bas - haut < 4) return null;
  return ferme([
    versCarte({ x: (gauche + droite) / 2, y: haut }),
    versCarte({ x: droite, y: bas }),
    versCarte({ x: gauche, y: bas }),
  ]);
}

export type FormePredeterminee = 'carre' | 'rond' | 'triangle';

export function polygoneForme(
  forme: FormePredeterminee,
  a: PointEcran,
  b: PointEcran,
  versCarte: VersCarte,
): GeoJSON.Polygon | null {
  if (forme === 'carre') return polygoneCarre(a, b, versCarte);
  if (forme === 'rond') return polygoneRond(a, b, versCarte);
  return polygoneTriangle(a, b, versCarte);
}
