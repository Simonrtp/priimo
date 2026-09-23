import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { polygoneCarre, polygoneRond, polygoneTriangle } from './formes';

const identite = (p: { x: number; y: number }): [number, number] => [p.x, p.y];

describe('formes prédéfinies', () => {
  it('trace un carré aligné sur les deux coins', () => {
    const poly = polygoneCarre({ x: 0, y: 10 }, { x: 8, y: 2 }, identite);
    assert.ok(poly);
    assert.deepEqual(poly.coordinates[0], [
      [0, 10],
      [8, 10],
      [8, 2],
      [0, 2],
      [0, 10],
    ]);
  });

  it('refuse un geste trop petit', () => {
    assert.equal(polygoneCarre({ x: 0, y: 0 }, { x: 2, y: 2 }, identite), null);
    assert.equal(polygoneRond({ x: 0, y: 0 }, { x: 1, y: 1 }, identite), null);
    assert.equal(polygoneTriangle({ x: 0, y: 0 }, { x: 2, y: 1 }, identite), null);
  });

  it('ferme un rond de 32 sommets plus le retour', () => {
    const poly = polygoneRond({ x: 10, y: 10 }, { x: 20, y: 10 }, identite);
    assert.ok(poly);
    assert.equal(poly.coordinates[0]?.length, 33);
    const premier = poly.coordinates[0]![0]!;
    const dernier = poly.coordinates[0]!.at(-1)!;
    assert.deepEqual(premier, dernier);
  });

  it('pointe le triangle vers le haut de l’écran', () => {
    const poly = polygoneTriangle({ x: 0, y: 10 }, { x: 10, y: 0 }, identite);
    assert.ok(poly);
    assert.deepEqual(poly.coordinates[0], [
      [5, 0],
      [10, 10],
      [0, 10],
      [5, 0],
    ]);
  });
});
