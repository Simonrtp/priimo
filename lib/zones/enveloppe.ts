import simplify from '@turf/simplify';
import union from '@turf/union';
import { featureCollection, polygon } from '@turf/helpers';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';
import type { ValeurPolygone } from './types';

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

/**
 * Le contour exact des parcelles d'un secteur, réunies en quelques polygones
 * légers (~1 m de tolérance). Aucune marge : ce qui est hors des parcelles du
 * secteur n'en fait pas partie. Une géométrie cadastrale invalide ne doit pas
 * priver le secteur de son contour : on garde alors chaque parcelle telle quelle.
 */
export function enveloppeDesParcelles(parcelles: readonly Anneaux[]): ValeurPolygone[] {
  const formes = parcelles.filter((a) => a.length > 0 && a[0]!.length >= 4).map((a) => polygon(a));
  if (formes.length === 0) return [];
  let unie: Feature<Polygon | MultiPolygon> | null;
  try {
    unie = formes.length === 1 ? formes[0]! : union(featureCollection(formes));
  } catch {
    return formes.flatMap((f) => versPolygones(f.geometry));
  }
  if (!unie) return [];
  return versPolygones(simplify(unie, { tolerance: 0.00001, highQuality: false }).geometry);
}
