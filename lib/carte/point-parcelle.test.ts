import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { indexerParcelles, lireParcelle, parcelleContient } from './point-parcelle';

const carre = (x: number, y: number, c: number) => [
  [x, y],
  [x + c, y],
  [x + c, y + c],
  [x, y + c],
  [x, y],
];

describe('point-parcelle', () => {
  it('reconnaît un point dans un polygone et hors de lui', () => {
    const p = lireParcelle('A', { type: 'Polygon', coordinates: [carre(2.38, 48.85, 0.001)] })!;
    assert.equal(parcelleContient(p, 2.3805, 48.8505), true);
    assert.equal(parcelleContient(p, 2.3815, 48.8505), false);
  });

  it('respecte les trous (cour intérieure d’une autre parcelle)', () => {
    const p = lireParcelle('A', {
      type: 'Polygon',
      coordinates: [carre(2.38, 48.85, 0.001), carre(2.3804, 48.8504, 0.0002)],
    })!;
    assert.equal(parcelleContient(p, 2.3805, 48.8505), false);
    assert.equal(parcelleContient(p, 2.3801, 48.8501), true);
  });

  it('trouve la bonne parcelle parmi ses voisines, y compris en MultiPolygon', () => {
    const index = indexerParcelles([
      lireParcelle('A', { type: 'Polygon', coordinates: [carre(2.38, 48.85, 0.001)] })!,
      lireParcelle('B', {
        type: 'MultiPolygon',
        coordinates: [[carre(2.381, 48.85, 0.001)], [carre(2.39, 48.86, 0.001)]],
      })!,
    ]);
    assert.equal(index.trouver(2.3805, 48.8505), 'A');
    assert.equal(index.trouver(2.3815, 48.8505), 'B');
    assert.equal(index.trouver(2.3905, 48.8605), 'B');
    assert.equal(index.trouver(2.37, 48.84), null);
  });

  it('ignore une géométrie illisible', () => {
    assert.equal(lireParcelle('X', { type: 'Point', coordinates: [2, 48] }), null);
    assert.equal(lireParcelle('X', null), null);
  });
});
