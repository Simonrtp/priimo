import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTournee, haversineM, orderNearestNeighbor } from './tournee';
import type { LocatedTask } from './tournee';

/** Autour de 48.86, 2.34 — 0.002° ≈ 220 m. */
function t(key: string, dLat: number, dLng: number): LocatedTask {
  return {
    key,
    address: key,
    latitude: 48.86 + dLat,
    longitude: 2.34 + dLng,
  };
}

describe('buildTournee', () => {
  it('ne forme pas de tournée avec 0 adresse', () => {
    assert.equal(buildTournee([], null), null);
  });

  it('ne forme pas de tournée avec 1 adresse', () => {
    assert.equal(buildTournee([t('a', 0, 0)], null), null);
  });

  it('forme une tournée de 2 adresses dans le rayon', () => {
    const tour = buildTournee([t('a', 0, 0), t('b', 0.002, 0)], null);
    assert.ok(tour);
    assert.equal(tour?.keys.length, 2);
  });

  it('écarte 2 adresses trop loin l’une de l’autre', () => {
    const tour = buildTournee([t('a', 0, 0), t('b', 0.05, 0.05)], null, 800);
    assert.equal(tour, null);
  });

  it('prend la plus grande grappe parmi 5 adresses', () => {
    const tasks = [
      t('a', 0, 0),
      t('b', 0.002, 0),
      t('c', 0.004, 0),
      t('d', 0.08, 0.08),
      t('e', 0.082, 0.08),
    ];
    const tour = buildTournee(tasks, null, 800);
    assert.ok(tour);
    assert.equal(tour?.keys.length, 3);
    assert.deepEqual(new Set(tour?.keys), new Set(['a', 'b', 'c']));
  });
});

describe('orderNearestNeighbor', () => {
  it('part de la première tâche sans GPS', () => {
    const ordered = orderNearestNeighbor([t('loin', 0.006, 0), t('pres', 0.001, 0)], null);
    assert.equal(ordered[0]?.key, 'loin');
    assert.equal(ordered[1]?.key, 'pres');
  });

  it('part du GPS quand il est fourni', () => {
    const origin = { latitude: 48.86, longitude: 2.34 };
    const ordered = orderNearestNeighbor(
      [t('loin', 0.006, 0), t('pres', 0.001, 0)],
      origin,
    );
    assert.equal(ordered[0]?.key, 'pres');
    assert.equal(ordered[1]?.key, 'loin');
  });
});

describe('haversineM', () => {
  it('mesure ~0 pour le même point', () => {
    const p = { latitude: 48.86, longitude: 2.34 };
    assert.ok(haversineM(p, p) < 1);
  });
});
