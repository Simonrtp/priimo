import buffer from '@turf/buffer';
import { featureCollection, polygon } from '@turf/helpers';
import simplify from '@turf/simplify';
import union from '@turf/union';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import type { ValeurPolygone } from './types';

/** La marge qui rattache une annonce « rue seule » au secteur voisin de sa rue. */
export const MARGE_ENVELOPPE_METRES = 30;

type Anneaux = Position[][];

function arrondir(p: Position): [number, number] {
  return [Math.round(p[0]! * 1e6) / 1e6, Math.round(p[1]! * 1e6) / 1e6];
}

function versPolygones(geom: Polygon | MultiPolygon): ValeurPolygone[] {
  const listes: Anneaux[] = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return listes
    .filter((anneaux) => anneaux.length > 0 && anneaux[0]!.length >= 4)
    .map((anneaux) => ({ type: 'Polygon', coordinates: anneaux.map((a) => a.map(arrondir)) }));
}

function fusionner(formes: Feature<Polygon | MultiPolygon>[]): Feature<Polygon | MultiPolygon> | null {
  if (formes.length === 0) return null;
  if (formes.length === 1) return formes[0]!;
  return union(featureCollection(formes));
}

/**
 * Les parcelles d'un secteur, réunies puis élargies de `marge` mètres et
 * simplifiées (~3 m) : quelques polygones légers, sans les rues intérieures.
 * Une géométrie cadastrale invalide ne doit pas priver le secteur de son
 * enveloppe : on élargit alors chaque parcelle avant de réunir.
 */
export function enveloppeDesParcelles(
  parcelles: readonly Anneaux[],
  marge = MARGE_ENVELOPPE_METRES,
): ValeurPolygone[] {
  const formes = parcelles.filter((a) => a.length > 0 && a[0]!.length >= 4).map((a) => polygon(a));
  if (formes.length === 0) return [];
  const elargir = (f: Feature<Polygon | MultiPolygon>) =>
    buffer(f, marge, { units: 'meters' }) as Feature<Polygon | MultiPolygon> | undefined;

  let elargie: Feature<Polygon | MultiPolygon> | null | undefined;
  try {
    const unie = fusionner(formes);
    elargie = unie ? elargir(unie) : null;
  } catch {
    elargie = fusionner(
      formes.map(elargir).filter((f): f is Feature<Polygon | MultiPolygon> => f != null),
    );
  }
  if (!elargie) return [];
  const simple = simplify(elargie, { tolerance: 0.00003, highQuality: false });
  return versPolygones(simple.geometry);
}
