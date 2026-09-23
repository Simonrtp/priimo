/**
 * Accroche d’un tracé de secteur aux parcelles cadastrales.
 *
 * Le PCI donne les formes géométriques des lots : leurs bords sont les rues.
 * On colle chaque point au bord le plus proche, puis on assemble l’enveloppe
 * des parcelles touchées — le contour suit alors le cadastre, pas le tremblement
 * de la main.
 */

export type Point = readonly [number, number];
export type Anneau = readonly Point[];

const DECIMALES = 6;

function clePoint(p: Point): string {
  return `${p[0].toFixed(DECIMALES)},${p[1].toFixed(DECIMALES)}`;
}

function cleArete(a: Point, b: Point): string {
  const ka = clePoint(a);
  const kb = clePoint(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/** Distance au carré d’un point au segment [a, b], plus le pied. */
export function piedSurSegment(p: Point, a: Point, b: Point): { point: Point; dist2: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const denom = dx * dx + dy * dy;
  if (denom === 0) {
    const dist2 = (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
    return { point: a, dist2 };
  }
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denom));
  const point: Point = [a[0] + t * dx, a[1] + t * dy];
  const dist2 = (p[0] - point[0]) ** 2 + (p[1] - point[1]) ** 2;
  return { point, dist2 };
}

/** Colle `p` au bord d’un anneau s’il est assez près (`maxDist` dans la même unité). */
export function accrocherAuBord(p: Point, anneaux: readonly Anneau[], maxDist: number): Point | null {
  const seuil = maxDist * maxDist;
  let meilleur: { point: Point; dist2: number } | null = null;
  for (const anneau of anneaux) {
    if (anneau.length < 2) continue;
    for (let i = 0; i < anneau.length - 1; i += 1) {
      const pied = piedSurSegment(p, anneau[i]!, anneau[i + 1]!);
      if (pied.dist2 > seuil) continue;
      if (!meilleur || pied.dist2 < meilleur.dist2) meilleur = pied;
    }
  }
  return meilleur ? meilleur.point : null;
}

export function anneauxDepuisGeometrie(geometry: GeoJSON.Geometry | null | undefined): [number, number][][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    const exterieur = geometry.coordinates[0];
    if (!exterieur || exterieur.length < 4) return [];
    return [exterieur.map((p) => [Number(p[0]), Number(p[1])] as [number, number])];
  }
  if (geometry.type === 'MultiPolygon') {
    const anneaux: [number, number][][] = [];
    for (const poly of geometry.coordinates) {
      const exterieur = poly[0];
      if (!exterieur || exterieur.length < 4) continue;
      anneaux.push(exterieur.map((p) => [Number(p[0]), Number(p[1])] as [number, number]));
    }
    return anneaux;
  }
  return [];
}

function aireAbsolue(anneau: Anneau): number {
  let s = 0;
  for (let i = 0; i < anneau.length - 1; i += 1) {
    const [x1, y1] = anneau[i]!;
    const [x2, y2] = anneau[i + 1]!;
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s / 2);
}

/**
 * Enveloppe des parcelles : les arêtes partagées s’annulent, il reste le
 * contour extérieur. Si l’assemblage échoue, on rend `null` — le tracé libre
 * prendra le relais.
 */
export function contourDepuisParcelles(anneaux: readonly Anneau[]): GeoJSON.Polygon | null {
  if (anneaux.length === 0) return null;
  if (anneaux.length === 1) {
    const seul = anneaux[0]!;
    if (seul.length < 4) return null;
    return { type: 'Polygon', coordinates: [seul.map((p) => [p[0], p[1]])] };
  }

  const comptes = new Map<string, { a: Point; b: Point; n: number }>();
  for (const anneau of anneaux) {
    if (anneau.length < 2) continue;
    for (let i = 0; i < anneau.length - 1; i += 1) {
      const a = anneau[i]!;
      const b = anneau[i + 1]!;
      if (clePoint(a) === clePoint(b)) continue;
      const cle = cleArete(a, b);
      const deja = comptes.get(cle);
      if (deja) deja.n += 1;
      else comptes.set(cle, { a, b, n: 1 });
    }
  }

  const libres = [...comptes.values()].filter((e) => e.n === 1);
  if (libres.length < 3) return null;

  const voisins = new Map<string, Point[]>();
  const poser = (de: Point, vers: Point) => {
    const cle = clePoint(de);
    const liste = voisins.get(cle);
    if (liste) liste.push(vers);
    else voisins.set(cle, [vers]);
  };
  for (const { a, b } of libres) {
    poser(a, b);
    poser(b, a);
  }

  const depart = libres.reduce((m, e) => (e.a[0] < m[0] || (e.a[0] === m[0] && e.a[1] < m[1]) ? e.a : m), libres[0]!.a);
  const ring: Point[] = [depart];
  const vus = new Set<string>();
  let courant = depart;
  const maxPas = libres.length + 2;

  for (let i = 0; i < maxPas; i += 1) {
    const options = voisins.get(clePoint(courant)) ?? [];
    let suivant: Point | null = null;
    for (const cand of options) {
      const arete = cleArete(courant, cand);
      if (vus.has(arete)) continue;
      suivant = cand;
      vus.add(arete);
      break;
    }
    if (!suivant) break;
    if (clePoint(suivant) === clePoint(depart)) {
      ring.push(depart);
      break;
    }
    ring.push(suivant);
    courant = suivant;
  }

  if (ring.length < 4 || clePoint(ring[0]!) !== clePoint(ring[ring.length - 1]!)) return null;
  if (aireAbsolue(ring) <= 0) return null;

  return { type: 'Polygon', coordinates: [ring.map((p) => [p[0], p[1]])] };
}

/** Centroïde d’un anneau fermé — pour savoir s’il est dans le geste. */
export function centroideAnneau(anneau: Anneau): Point | null {
  if (anneau.length < 3) return null;
  let x = 0;
  let y = 0;
  let n = 0;
  const fin = clePoint(anneau[0]!) === clePoint(anneau[anneau.length - 1]!) ? anneau.length - 1 : anneau.length;
  for (let i = 0; i < fin; i += 1) {
    x += anneau[i]![0];
    y += anneau[i]![1];
    n += 1;
  }
  if (n === 0) return null;
  return [x / n, y / n];
}
