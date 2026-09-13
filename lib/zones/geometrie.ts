import { pointDansPolygone } from './appartenance';
import type { ValeurPolygone, Zone } from './types';

/**
 * Géométrie de contrôle : détecter les recouvrements et les trous.
 *
 * Un chevauchement n'est pas une erreur — deux agents peuvent se partager un
 * axe commerçant. On le SIGNALE, on ne le bloque pas. Ce qui est grave, c'est
 * de ne pas le savoir.
 */

export type Bbox = { ouest: number; sud: number; est: number; nord: number };

export function bbox(polygone: ValeurPolygone): Bbox | null {
  const anneau = polygone.coordinates[0];
  if (!anneau || anneau.length < 3) return null;
  let ouest = Infinity;
  let sud = Infinity;
  let est = -Infinity;
  let nord = -Infinity;
  for (const [lng, lat] of anneau) {
    if (lng < ouest) ouest = lng;
    if (lng > est) est = lng;
    if (lat < sud) sud = lat;
    if (lat > nord) nord = lat;
  }
  return { ouest, sud, est, nord };
}

function bboxSeTouchent(a: Bbox, b: Bbox): boolean {
  return !(a.est < b.ouest || b.est < a.ouest || a.nord < b.sud || b.nord < a.sud);
}

function orientation(
  [ax, ay]: readonly [number, number],
  [bx, by]: readonly [number, number],
  [cx, cy]: readonly [number, number],
): number {
  const d = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(d) < 1e-12) return 0;
  return d > 0 ? 1 : -1;
}

/**
 * Croisement franc seulement. Un contact par un sommet ou un bord commun ne
 * compte pas : deux secteurs voisins partagent forcément une frontière, et
 * l'annoncer comme un recouvrement rendrait l'alerte inutilisable.
 */
function segmentsSeCroisent(
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
  p4: readonly [number, number],
): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) return false;
  return o1 !== o2 && o3 !== o4;
}

function sommets(polygone: ValeurPolygone): readonly (readonly [number, number])[] {
  return polygone.coordinates[0] ?? [];
}

/** ~10 cm : un sommet posé sur la frontière du voisin est indécidable. */
const RETRAIT_DEG = 1e-6;

/**
 * Sommets ramenés vers l'intérieur de leur propre contour. Sans ce retrait,
 * deux secteurs jointifs — un pavage, donc un cas normal — seraient signalés
 * comme un recouvrement à chaque bord commun.
 */
function sommetsRentres(polygone: ValeurPolygone): [number, number][] {
  const b = bbox(polygone);
  const liste = sommets(polygone);
  if (!b) return liste.map(([lng, lat]) => [lng, lat]);
  const cx = (b.ouest + b.est) / 2;
  const cy = (b.sud + b.nord) / 2;

  return liste.map(([lng, lat]) => {
    const dx = cx - lng;
    const dy = cy - lat;
    const norme = Math.hypot(dx, dy);
    if (norme === 0) return [lng, lat];
    return [lng + (dx / norme) * RETRAIT_DEG, lat + (dy / norme) * RETRAIT_DEG];
  });
}

/**
 * Deux contours se recouvrent si l'un contient un sommet de l'autre, ou si
 * leurs bords se croisent. Le second cas compte : deux rectangles en croix
 * n'ont aucun sommet chez le voisin et se chevauchent pourtant.
 */
export function polygonesSeChevauchent(a: ValeurPolygone, b: ValeurPolygone): boolean {
  const ba = bbox(a);
  const bb = bbox(b);
  if (!ba || !bb || !bboxSeTouchent(ba, bb)) return false;

  const sa = sommets(a);
  const sb = sommets(b);

  for (const [lng, lat] of sommetsRentres(a)) {
    if (pointDansPolygone({ latitude: lat, longitude: lng }, b)) return true;
  }
  for (const [lng, lat] of sommetsRentres(b)) {
    if (pointDansPolygone({ latitude: lat, longitude: lng }, a)) return true;
  }

  for (let i = 0; i < sa.length - 1; i += 1) {
    for (let j = 0; j < sb.length - 1; j += 1) {
      if (segmentsSeCroisent(sa[i]!, sa[i + 1]!, sb[j]!, sb[j + 1]!)) return true;
    }
  }
  return false;
}

export type Chevauchement = { zoneA: Zone; zoneB: Zone };

/**
 * Les paires de zones qui se marchent dessus. Seules les inclusions comptent :
 * une exclusion rétrécit un secteur, elle ne peut pas créer de conflit.
 */
export function chevauchements(zones: readonly Zone[]): Chevauchement[] {
  const contours = zones
    .filter((z) => z.actif)
    .map((zone) => ({
      zone,
      polygones: zone.regles
        .filter((r) => r.inclusion && r.type === 'polygone')
        .map((r) => r.valeur as ValeurPolygone),
    }))
    .filter((c) => c.polygones.length > 0);

  const trouves: Chevauchement[] = [];
  for (let i = 0; i < contours.length; i += 1) {
    for (let j = i + 1; j < contours.length; j += 1) {
      const a = contours[i]!;
      const b = contours[j]!;
      const conflit = a.polygones.some((pa) =>
        b.polygones.some((pb) => polygonesSeChevauchent(pa, pb)),
      );
      if (conflit) trouves.push({ zoneA: a.zone, zoneB: b.zone });
    }
  }
  return trouves;
}

/** Centre d'un contour, pour poser une étiquette ou recadrer la carte. */
export function centrePolygone(polygone: ValeurPolygone): { latitude: number; longitude: number } | null {
  const b = bbox(polygone);
  if (!b) return null;
  return { latitude: (b.sud + b.nord) / 2, longitude: (b.ouest + b.est) / 2 };
}

export function fusionnerBbox(boites: readonly Bbox[]): Bbox | null {
  if (boites.length === 0) return null;
  return boites.reduce((acc, b) => ({
    ouest: Math.min(acc.ouest, b.ouest),
    sud: Math.min(acc.sud, b.sud),
    est: Math.max(acc.est, b.est),
    nord: Math.max(acc.nord, b.nord),
  }));
}

/** Emprise d'un secteur, pour recadrer la carte dessus. */
export function bboxDeZone(zone: Zone): Bbox | null {
  return fusionnerBbox(polygonesDeZone(zone).map(bbox).filter((b): b is Bbox => b !== null));
}

export function bboxVersBounds(boite: Bbox): [[number, number], [number, number]] {
  return [
    [boite.ouest, boite.sud],
    [boite.est, boite.nord],
  ];
}

/** Contours d'une zone, prêts à être posés sur la carte. */
export function polygonesDeZone(zone: Zone): ValeurPolygone[] {
  return zone.regles
    .filter((r) => r.inclusion && r.type === 'polygone')
    .map((r) => r.valeur as ValeurPolygone);
}
