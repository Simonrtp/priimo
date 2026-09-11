/**
 * Retouche d'un contour déjà posé.
 *
 * Un secteur se corrige, il ne se redessine pas : l'agent qui a suivi ses rues
 * pendant dix minutes ne doit pas tout reprendre parce qu'un angle mord sur le
 * voisin. On attrape un sommet et on le tire ; on attrape le milieu d'un
 * segment et le trait suit, un sommet naissant sous le doigt.
 *
 * L'anneau ressort fermé de chaque opération. Un contour ouvert n'est plus une
 * surface : la règle deviendrait muette sans que rien ne le signale.
 */

export type Sommet = readonly [number, number];

/** En dessous, le contour n'enferme plus rien. */
export const SOMMETS_DISTINCTS_MINIMUM = 3;

/**
 * Anneau fermé, en copie modifiable. GeoJSON répète le premier sommet à la
 * fin ; on ne fait jamais confiance à une donnée venue de la base pour ça.
 */
function normaliser(anneau: readonly (readonly number[])[]): number[][] {
  const points = anneau.map((p) => [p[0] ?? 0, p[1] ?? 0]);
  const premier = points[0];
  const dernier = points[points.length - 1];
  if (!premier || !dernier) return points;
  if (premier[0] !== dernier[0] || premier[1] !== dernier[1]) {
    points.push([premier[0]!, premier[1]!]);
  }
  return points;
}

function remplacerAnneau(
  polygone: GeoJSON.Polygon,
  indexAnneau: number,
  anneau: number[][],
): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: polygone.coordinates.map((a, i) => (i === indexAnneau ? anneau : a.map((p) => [...p]))),
  };
}

/**
 * Les sommets qu'on peut attraper. La répétition finale n'en est pas un de
 * plus : deux poignées superposées au même endroit, l'une inerte, seraient
 * incompréhensibles.
 */
export function sommetsManipulables(anneau: readonly (readonly number[])[]): Sommet[] {
  const points = normaliser(anneau);
  return points.slice(0, -1).map((p) => [p[0]!, p[1]!] as Sommet);
}

/** Milieu de chaque segment : l'endroit où le trait se laisse tirer. */
export function milieuxSegments(
  anneau: readonly (readonly number[])[],
): { apres: number; point: Sommet }[] {
  const points = normaliser(anneau);
  const milieux: { apres: number; point: Sommet }[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    milieux.push({ apres: i, point: [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2] });
  }
  return milieux;
}

export function deplacerSommet(
  polygone: GeoJSON.Polygon,
  indexAnneau: number,
  indexSommet: number,
  vers: Sommet,
): GeoJSON.Polygon {
  const anneau = polygone.coordinates[indexAnneau];
  if (!anneau) return polygone;
  const points = normaliser(anneau);
  const fermeture = points.length - 1;
  if (indexSommet < 0 || indexSommet >= fermeture) return polygone;

  points[indexSommet] = [vers[0], vers[1]];
  // Le premier sommet et la fermeture sont le même point du monde réel.
  if (indexSommet === 0) points[fermeture] = [vers[0], vers[1]];
  return remplacerAnneau(polygone, indexAnneau, points);
}

/** Naissance d'un sommet entre `apres` et le suivant. */
export function insererSommet(
  polygone: GeoJSON.Polygon,
  indexAnneau: number,
  apres: number,
  point: Sommet,
): GeoJSON.Polygon {
  const anneau = polygone.coordinates[indexAnneau];
  if (!anneau) return polygone;
  const points = normaliser(anneau);
  if (apres < 0 || apres >= points.length - 1) return polygone;

  points.splice(apres + 1, 0, [point[0], point[1]]);
  return remplacerAnneau(polygone, indexAnneau, points);
}

/** Rend null quand retirer ce sommet ne laisserait plus de surface. */
export function retirerSommet(
  polygone: GeoJSON.Polygon,
  indexAnneau: number,
  indexSommet: number,
): GeoJSON.Polygon | null {
  const anneau = polygone.coordinates[indexAnneau];
  if (!anneau) return null;
  const points = normaliser(anneau);
  const fermeture = points.length - 1;
  if (fermeture <= SOMMETS_DISTINCTS_MINIMUM) return null;
  if (indexSommet < 0 || indexSommet >= fermeture) return null;

  points.splice(indexSommet, 1);
  if (indexSommet === 0) {
    // La fermeture suivait l'ancien premier sommet : elle suit le nouveau.
    const premier = points[0]!;
    points[points.length - 1] = [premier[0]!, premier[1]!];
  }
  return remplacerAnneau(polygone, indexAnneau, points);
}
