import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pointDansPolygone } from './appartenance';
import { enveloppeDesParcelles } from './enveloppe';

/** Un carré d'environ 20 m de côté autour d'un point de Paris. */
function carre(lng: number, lat: number): number[][][] {
  const d = 0.0001;
  return [
    [
      [lng - d, lat - d],
      [lng + d, lat - d],
      [lng + d, lat + d],
      [lng - d, lat + d],
      [lng - d, lat - d],
    ],
  ];
}

const dedans = (polys: ReturnType<typeof enveloppeDesParcelles>, lng: number, lat: number) =>
  polys.some((p) => pointDansPolygone({ latitude: lat, longitude: lng }, p));

describe('enveloppeDesParcelles', () => {
  it('réunit les parcelles voisines et les élargit d’une trentaine de mètres', () => {
    const polys = enveloppeDesParcelles([carre(2.39, 48.86), carre(2.3902, 48.86)]);
    assert.equal(polys.length, 1);
    // 25 m au nord de la parcelle : dedans ; 60 m : dehors.
    assert.ok(dedans(polys, 2.39, 48.86 + 0.0001 + 0.000225));
    assert.ok(!dedans(polys, 2.39, 48.86 + 0.0001 + 0.00054));
  });

  it('deux îlots éloignés restent deux polygones', () => {
    assert.equal(enveloppeDesParcelles([carre(2.39, 48.86), carre(2.4, 48.87)]).length, 2);
  });

  it('rien à envelopper, rien à rendre', () => {
    assert.deepEqual(enveloppeDesParcelles([]), []);
  });
});
