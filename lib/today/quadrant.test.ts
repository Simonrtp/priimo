import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tourneeQuadrantLabel, tourneeTitle } from './quadrant';

describe('tourneeQuadrantLabel', () => {
  it('nomme le quadrant relatif au centre secteur', () => {
    const sectorRef = { latitude: 48.86, longitude: 2.34 };
    const label = tourneeQuadrantLabel(
      [
        { latitude: 48.865, longitude: 2.345 },
        { latitude: 48.866, longitude: 2.346 },
      ],
      sectorRef,
    );
    assert.equal(label, 'Zone Nord-Est');
  });

  it('retourne null sans référence secteur', () => {
    assert.equal(
      tourneeQuadrantLabel([{ latitude: 48.86, longitude: 2.34 }], null),
      null,
    );
  });
});

describe('tourneeTitle', () => {
  it('priorise le quadrant quand il est connu', () => {
    assert.equal(
      tourneeTitle({ stopCount: 2, quadrantLabel: 'Zone Nord-Est' }),
      'Tournée · Zone Nord-Est · aujourd’hui',
    );
  });
});
