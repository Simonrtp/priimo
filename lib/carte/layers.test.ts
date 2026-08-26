import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_MAP_LAYERS, parseMapLayers } from './layers';

describe('parseMapLayers', () => {
  it('laisse le cadastre éteint par défaut', () => {
    assert.equal(parseMapLayers(null).cadastre, false);
    assert.equal(DEFAULT_MAP_LAYERS.cadastre, false);
    assert.equal(DEFAULT_MAP_LAYERS.cadastreDpe, false);
  });

  it('n’active les biens par défaut', () => {
    assert.equal(parseMapLayers(null).bien, true);
    assert.equal(DEFAULT_MAP_LAYERS.bien, true);
  });

  it('reprend l’ancien interrupteur parcelles', () => {
    assert.equal(parseMapLayers({ lead: false, parcelles: true }).cadastre, true);
    assert.equal(parseMapLayers({ cadastre: true, cadastreDpe: true }).cadastreDpe, true);
  });
});
