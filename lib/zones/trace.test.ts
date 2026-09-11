import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { polygoneDepuisTrace, simplifier, type PointTrace } from './trace';

describe('simplification d’un tracé', () => {
  it('réduit une ligne droite à ses deux extrémités', () => {
    const points: PointTrace[] = [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ];
    assert.deepEqual(simplifier(points, 0.1), [
      [0, 0],
      [3, 0],
    ]);
  });

  it('garde une inflexion plus grande que la tolérance', () => {
    const points: PointTrace[] = [
      [0, 0],
      [1, 5],
      [2, 0],
    ];
    assert.equal(simplifier(points, 1).length, 3);
  });

  it('laisse passer un tracé de deux points', () => {
    const points: PointTrace[] = [
      [0, 0],
      [1, 1],
    ];
    assert.deepEqual(simplifier(points, 10), points);
  });
});

describe('fermeture d’un tracé à main levée', () => {
  it('ferme un carré et répète le premier sommet', () => {
    const polygone = polygoneDepuisTrace(
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ],
      0.0001,
    );
    assert.ok(polygone);
    const anneau = polygone.coordinates[0]!;
    assert.equal(anneau.length, 5);
    assert.deepEqual(anneau[0], anneau[anneau.length - 1]);
  });

  it('ne rend rien pour un clic isolé', () => {
    assert.equal(polygoneDepuisTrace([[2.3, 48.8]], 0.0001), null);
  });

  it('ne rend rien pour un aller-retour sur place', () => {
    // Un tremblement de souris : tout s'aligne, il ne reste que deux sommets.
    const points: PointTrace[] = [
      [0, 0],
      [0.5, 0],
      [1, 0],
      [0.5, 0],
      [0, 0],
    ];
    assert.equal(polygoneDepuisTrace(points, 0.1), null);
  });

  it('ne compte pas deux fois un point répété', () => {
    const points: PointTrace[] = [
      [0, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ];
    const polygone = polygoneDepuisTrace(points, 0.0001);
    assert.ok(polygone);
    assert.equal(polygone.coordinates[0]!.length, 4);
  });
});
