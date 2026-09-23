import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  accrocherAuBord,
  anneauxDepuisGeometrie,
  contourDepuisParcelles,
  piedSurSegment,
} from './parcelles-contour';

const carre = (x: number, y: number, cote = 1): [number, number][] => [
  [x, y],
  [x + cote, y],
  [x + cote, y + cote],
  [x, y + cote],
  [x, y],
];

describe('pied sur un segment', () => {
  it('tombe au milieu d’un segment horizontal', () => {
    const pied = piedSurSegment([0.5, 1], [0, 0], [1, 0]);
    assert.equal(pied.point[0], 0.5);
    assert.equal(pied.point[1], 0);
  });
});

describe('accroche au bord d’une parcelle', () => {
  it('colle un point proche au côté du carré', () => {
    const colle = accrocherAuBord([0.4, -0.02], [carre(0, 0)], 0.05);
    assert.ok(colle);
    assert.ok(Math.abs(colle[1]) < 1e-9);
    assert.ok(Math.abs(colle[0] - 0.4) < 1e-9);
  });

  it('laisse un point trop loin', () => {
    assert.equal(accrocherAuBord([5, 5], [carre(0, 0)], 0.05), null);
  });
});

describe('enveloppe de parcelles jointives', () => {
  it('fusionne deux carrés voisins en un rectangle', () => {
    const poly = contourDepuisParcelles([carre(0, 0), carre(1, 0)]);
    assert.ok(poly);
    const anneau = poly.coordinates[0] ?? [];
    const xs = anneau.map((p) => p[0]);
    const ys = anneau.map((p) => p[1]);
    assert.equal(Math.min(...xs), 0);
    assert.equal(Math.max(...xs), 2);
    assert.equal(Math.min(...ys), 0);
    assert.equal(Math.max(...ys), 1);
    assert.ok(anneau.length >= 5);
  });

  it('rend le polygone tel quel s’il n’y a qu’une parcelle', () => {
    const seul = carre(2, 3);
    const poly = contourDepuisParcelles([seul]);
    assert.deepEqual(poly?.coordinates[0], seul);
  });
});

describe('lecture d’une géométrie PCI', () => {
  it('extrait l’anneau extérieur d’un polygone', () => {
    const anneaux = anneauxDepuisGeometrie({
      type: 'Polygon',
      coordinates: [carre(0, 0), [[0.2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4], [0.2, 0.2]]],
    });
    assert.equal(anneaux.length, 1);
    assert.deepEqual(anneaux[0], carre(0, 0));
  });
});
