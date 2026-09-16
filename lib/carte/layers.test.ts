import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_MAP_LAYERS,
  MAP_LAYERS_STORAGE_REV,
  migrateStoredMapLayers,
  parseMapLayers,
  withCadastreLayerToggled,
  withDpeAgeSpan,
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

  it('ne couple plus Parcelles et Diagnostics', () => {
    assert.equal(parseMapLayers({ cadastre: true }).cadastreDpe, false);
    const next = withCadastreLayerToggled(
      { ...DEFAULT_MAP_LAYERS, cadastre: false, cadastreDpe: false },
      'parcelles',
    );
    assert.equal(next.cadastre, true);
    assert.equal(next.cadastreDpe, false);
  });

  it('persiste la plage d’ancienneté du curseur', () => {
    const parsed = parseMapLayers({ cadastreDpeAges: ['semaine', '3+'] });
    assert.deepEqual(parsed.cadastreDpeAges, ['semaine', '3+']);
    assert.deepEqual(withDpeAgeSpan(parsed, 1, 3).cadastreDpeAges, ['mois', '1-6', '6-12']);
  });

  it('persiste l’état du menu Cadastre', () => {
    assert.equal(parseMapLayers({}).cadastreMenuOpen, true);
    assert.equal(parseMapLayers({ cadastreMenuOpen: false }).cadastreMenuOpen, false);
  });

  it('reprend toutes les cases d’ancienneté si absentes', () => {
    assert.equal(parseMapLayers({}).cadastreDpeAges.length, 6);
  });

  it('ne réallume plus DPE sur une session Cadastre seule en rev 2+', () => {
    const migrated = migrateStoredMapLayers(
      { ...DEFAULT_MAP_LAYERS, cadastre: true, cadastreDpe: false },
      2,
    );
    assert.equal(migrated.state.cadastreDpe, false);
    assert.equal(migrated.rev, MAP_LAYERS_STORAGE_REV);
  });
});
