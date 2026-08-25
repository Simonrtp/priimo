import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_MAP_LAYERS, parseMapLayers } from './layers';

describe('parseMapLayers', () => {
  it('laisse les parcelles éteintes par défaut', () => {
    assert.equal(parseMapLayers(null).parcelles, false);
    assert.equal(DEFAULT_MAP_LAYERS.parcelles, false);
  });

  it('n’active les parcelles que si elles sont explicitement vraies', () => {
    assert.equal(parseMapLayers({ lead: false, parcelles: true }).parcelles, true);
    assert.equal(parseMapLayers({ parcelles: 'oui' }).parcelles, false);
  });
});
