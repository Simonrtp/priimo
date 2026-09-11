/**
 * Tracé d'un contour de secteur à main levée.
 *
 * L'agent suit ses rues d'un geste continu : on récolte des centaines de
 * points pour quelques inflexions réelles. On ne garde que celles-ci — un
 * contour à quatre cents sommets serait impossible à retoucher ensuite,
 * sommet par sommet, et pèserait pour rien dans le jsonb de la règle.
 */

export type PointTrace = readonly [number, number];

/** Distance d'un point au segment [a, b], dans l'unité des points. */
function distanceAuSegment(p: PointTrace, a: PointTrace, b: PointTrace): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Douglas–Peucker. `tolerance` s'exprime dans l'unité des points : des degrés
 * si on lui passe des coordonnées, des pixels si on lui passe un écran.
 */
export function simplifier(points: readonly PointTrace[], tolerance: number): PointTrace[] {
  if (points.length <= 2 || tolerance <= 0) return [...points];

  const premier = points[0]!;
  const dernier = points[points.length - 1]!;
  let indexMax = 0;
  let distanceMax = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = distanceAuSegment(points[i]!, premier, dernier);
    if (d > distanceMax) {
      distanceMax = d;
      indexMax = i;
    }
  }

  if (distanceMax <= tolerance) return [premier, dernier];

  const gauche = simplifier(points.slice(0, indexMax + 1), tolerance);
  const droite = simplifier(points.slice(indexMax), tolerance);
  return [...gauche.slice(0, -1), ...droite];
}

/** Un anneau a besoin de trois sommets distincts pour enfermer une surface. */
export const SOMMETS_MINIMUM = 3;

function memePoint(a: PointTrace, b: PointTrace): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * Ferme un geste en polygone GeoJSON, ou rend `null` si le geste ne décrit
 * aucune surface : un clic isolé, un tremblement, un aller-retour sur place.
 * Mieux vaut ne rien créer que créer un secteur vide qu'il faudra effacer.
 */
export function polygoneDepuisTrace(
  points: readonly PointTrace[],
  tolerance: number,
): GeoJSON.Polygon | null {
  const simples = simplifier(points, tolerance);

  const anneau: PointTrace[] = [];
  for (const p of simples) {
    const precedent = anneau[anneau.length - 1];
    if (!precedent || !memePoint(precedent, p)) anneau.push(p);
  }
  if (anneau.length < SOMMETS_MINIMUM) return null;

  const premier = anneau[0]!;
  const dernier = anneau[anneau.length - 1]!;
  const ferme = memePoint(premier, dernier) ? anneau : [...anneau, premier];
  // Trois sommets plus la répétition du premier : en dessous, ce n'est pas
  // une surface mais une ligne repliée.
  if (ferme.length < SOMMETS_MINIMUM + 1) return null;

  return {
    type: 'Polygon',
    coordinates: [ferme.map((p) => [p[0], p[1]])],
  };
}
