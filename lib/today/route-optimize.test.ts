import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GeoCoord } from '@/lib/carte/coords';
import { orderNearestNeighbor } from './sortie';
import { loopDistanceM, loopWaypoints, optimizeLoopOrder } from './route-optimize';

const BASE = { latitude: 48.86, longitude: 2.34 };
const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON = 111_320 * Math.cos((BASE.latitude * Math.PI) / 180);

type Stop = GeoCoord & { key: string };

/** Décalage en mètres autour de `BASE` — repère isotrope, la géométrie du test reste plane. */
function at(key: string, eastM: number, northM: number): Stop {
  return {
    key,
    latitude: BASE.latitude + northM / M_PER_DEG_LAT,
    longitude: BASE.longitude + eastM / M_PER_DEG_LON,
  };
}

function keys(stops: readonly Stop[]): string[] {
  return stops.map((s) => s.key);
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([items[i]!, ...tail]);
  }
  return out;
}

/**
 * Piège classique du plus proche voisin : le détour par le point décalé
 * coûte deux longs sauts en fin de boucle.
 */
const TRAP: Stop[] = [
  at('p1', 100, 0),
  at('p2', 200, 0),
  at('p3', 300, 0),
  at('p4', 150, 40),
];

describe('optimizeLoopOrder', () => {
  it('garde tous les arrêts, une seule fois', () => {
    const ordered = optimizeLoopOrder(TRAP, BASE);
    assert.equal(ordered.length, TRAP.length);
    assert.deepEqual([...keys(ordered)].sort(), [...keys(TRAP)].sort());
  });

  it('fait mieux que le plus proche voisin sur une boucle piégée', () => {
    const nn = orderNearestNeighbor(
      TRAP.map((s) => ({ ...s, address: s.key })),
      BASE,
    ) as unknown as Stop[];
    const optimized = optimizeLoopOrder(TRAP, BASE);

    assert.ok(
      loopDistanceM(optimized, BASE) < loopDistanceM(nn, BASE) - 1,
      'la boucle optimisée doit être strictement plus courte',
    );
  });

  it('atteint l’optimum exact (vérifié par énumération)', () => {
    const stops = [
      at('a', 0, 220),
      at('b', 260, 180),
      at('c', 120, -140),
      at('d', 320, -60),
      at('e', -180, 60),
      at('f', 60, 40),
    ];
    const optimized = loopDistanceM(optimizeLoopOrder(stops, BASE), BASE);
    let brute = Infinity;
    for (const candidate of permutations(stops)) {
      brute = Math.min(brute, loopDistanceM(candidate, BASE));
    }
    assert.ok(Math.abs(optimized - brute) < 1e-6, `${optimized} vs ${brute}`);
  });

  it('repart du départ : l’arrêt le plus proche de l’agence ouvre la boucle', () => {
    const ordered = optimizeLoopOrder([at('loin', 0, 600), at('pres', 0, 100)], BASE);
    assert.equal(ordered[0]!.key, 'pres');
  });

  it('ne réordonne pas à égalité — un recalcul rend le même ordre', () => {
    const stops = [at('x', 0, 100), at('y', 0, 200)];
    assert.deepEqual(keys(optimizeLoopOrder(stops, BASE)), ['x', 'y']);
    assert.deepEqual(keys(optimizeLoopOrder(optimizeLoopOrder(stops, BASE), BASE)), ['x', 'y']);
  });

  it('ordonne aussi sans départ connu', () => {
    const ordered = optimizeLoopOrder([at('c', 0, 300), at('a', 0, 0), at('b', 0, 150)], null);
    assert.equal(ordered.length, 3);
    assert.deepEqual([...keys(ordered)].sort(), ['a', 'b', 'c']);
  });
});

describe('loopDistanceM', () => {
  it('compte le retour au départ', () => {
    const stops = [at('a', 0, 100)];
    const distanceM = loopDistanceM(stops, BASE);
    assert.ok(Math.abs(distanceM - 200) < 2, `${distanceM}`);
  });

  it('sans départ, mesure le chemin ouvert', () => {
    const distanceM = loopDistanceM([at('a', 0, 0), at('b', 0, 100)], null);
    assert.ok(Math.abs(distanceM - 100) < 2, `${distanceM}`);
  });

  it('vaut 0 sans arrêt', () => {
    assert.equal(loopDistanceM([], BASE), 0);
  });
});

describe('loopWaypoints', () => {
  it('referme la boucle sur le départ', () => {
    const points = loopWaypoints([at('a', 0, 100), at('b', 0, 200)], BASE);
    assert.equal(points.length, 4);
    assert.deepEqual(points[0], BASE);
    assert.deepEqual(points[3], BASE);
  });

  it('sans départ, ne referme rien', () => {
    assert.equal(loopWaypoints([at('a', 0, 100), at('b', 0, 200)], null).length, 2);
  });
});
