import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleImageEpingle, dessinDepuisCle, epingleSous, type EpingleDessin } from './epingles';

describe('cleImageEpingle', () => {
  it('relit à l’identique le dessin encodé dans la clé', () => {
    const dessin: EpingleDessin = {
      couleur: '#0F8F4A',
      kind: 'contact',
      nombre: 3,
      anneau: 0.35,
      lisere: true,
      bordure: '#f4efe8',
    };
    assert.deepEqual(dessinDepuisCle(cleImageEpingle(dessin)), dessin);
  });

  it('donne une image par combinaison', () => {
    const base: EpingleDessin = { couleur: '#E8743C', kind: 'lead', nombre: 1, anneau: 0, lisere: false, bordure: '#ffffff' };
    assert.notEqual(cleImageEpingle(base), cleImageEpingle({ ...base, anneau: 0.45 }));
    assert.notEqual(cleImageEpingle(base), cleImageEpingle({ ...base, nombre: 2 }));
  });

  it('ignore les images qui ne sont pas des épingles', () => {
    assert.equal(dessinDepuisCle('marker-15'), null);
    assert.equal(dessinDepuisCle('epingle:{pas du json'), null);
  });
});

describe('epingleSous', () => {
  const feature = (id: string, ordre: number, layer = 'priimo-epingles') => ({
    properties: { id, ordre },
    geometry: { type: 'Point', coordinates: [ordre, 0] },
    layer: { id: layer },
  });
  // Projection factice : une unité de longitude = un pixel.
  const carte = (hits: unknown[]) =>
    ({
      getLayer: () => ({}),
      queryRenderedFeatures: () => hits,
      project: ([lng, lat]: [number, number]) => ({ x: lng, y: lat }),
    }) as unknown as Parameters<typeof epingleSous>[0];

  it('prend la plus haute des épingles sous le doigt', () => {
    const map = carte([feature('a', 1), feature('b', 4)]);
    assert.equal(epingleSous(map, { x: 2, y: 0 }), 'b');
  });

  it('fait passer l’épingle ouverte avant les autres', () => {
    const map = carte([feature('a', 9), feature('ouverte', 1, 'priimo-epingles-dessus')]);
    assert.equal(epingleSous(map, { x: 3, y: 0 }), 'ouverte');
  });

  it('ignore une épingle dont seul le coin de l’image est touché', () => {
    const map = carte([feature('loin', 40)]);
    assert.equal(epingleSous(map, { x: 0, y: 0 }), null);
  });
});
