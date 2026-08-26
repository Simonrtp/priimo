import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_MAP_LAYERS,
  MAP_LAYERS_STORAGE_REV,
  migrateStoredMapLayers,
  parseMapLayers,
  withCadastreToggled,
} from './layers';

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

  it('allume les points DPE en ouvrant Cadastre', () => {
    const next = withCadastreToggled({ ...DEFAULT_MAP_LAYERS, cadastre: false, cadastreDpe: false });
    assert.equal(next.cadastre, true);
    assert.equal(next.cadastreDpe, true);
  });

  it('allume DPE si Cadastre est déjà coché sans clé cadastreDpe', () => {
    assert.equal(parseMapLayers({ cadastre: true }).cadastreDpe, true);
    assert.equal(parseMapLayers({ cadastre: true, cadastreDpe: false }).cadastreDpe, false);
  });

  it('migre une session Cadastre sans DPE', () => {
    const migrated = migrateStoredMapLayers(
      { ...DEFAULT_MAP_LAYERS, cadastre: true, cadastreDpe: false },
      0,
    );
    assert.equal(migrated.state.cadastreDpe, true);
    assert.equal(migrated.rev, MAP_LAYERS_STORAGE_REV);
  });
});
