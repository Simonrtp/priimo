import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_MAP_LAYERS,
  MAP_LAYERS_STORAGE_REV,
  migrateStoredMapLayers,
  parseMapLayers,
  showParcellesPlan,
  withCadastreLayerToggled,
  withDpeAgeSpan,
} from './layers';

describe('parseMapLayers', () => {
  it('laisse le plan et les pastilles éteints par défaut', () => {
    assert.equal(parseMapLayers(null).cadastre, false);
    assert.equal(DEFAULT_MAP_LAYERS.cadastre, false);
    assert.equal(DEFAULT_MAP_LAYERS.cadastreDpe, false);
    assert.equal(DEFAULT_MAP_LAYERS.cadastreVentes, false);
    assert.equal(DEFAULT_MAP_LAYERS.cadastreCopro, false);
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

  it('affiche le plan dès qu’un overlay est coché', () => {
    assert.equal(showParcellesPlan(DEFAULT_MAP_LAYERS), false);
    assert.equal(
      showParcellesPlan({ ...DEFAULT_MAP_LAYERS, cadastre: true }),
      true,
    );
    assert.equal(
      showParcellesPlan({ ...DEFAULT_MAP_LAYERS, cadastreDpe: true }),
      true,
    );
    assert.equal(
      showParcellesPlan({ ...DEFAULT_MAP_LAYERS, cadastreVentes: true }),
      true,
    );
  });

  it('persiste la plage d’ancienneté du curseur', () => {
    const parsed = parseMapLayers({ cadastreDpeAges: ['semaine', '3+'] });
    assert.deepEqual(parsed.cadastreDpeAges, ['semaine', '3+']);
    assert.deepEqual(withDpeAgeSpan(parsed, 1, 3).cadastreDpeAges, ['semaine', 'mois', '1-6']);
  });

  it('persiste l’état du menu Cadastre', () => {
    assert.equal(parseMapLayers({}).cadastreMenuOpen, true);
    assert.equal(parseMapLayers({ cadastreMenuOpen: false }).cadastreMenuOpen, false);
  });

  it('reprend toutes les cases d’ancienneté si absentes', () => {
    assert.equal(parseMapLayers({}).cadastreDpeAges.length, 7);
  });

  it('rev 6 éteint le plan (et les pastilles si rev < 5)', () => {
    const fromRev3 = migrateStoredMapLayers(
      { ...DEFAULT_MAP_LAYERS, cadastre: true, cadastreDpe: true, cadastreVentes: true },
      3,
    );
    assert.equal(fromRev3.state.cadastre, false);
    assert.equal(fromRev3.state.cadastreDpe, false);
    assert.equal(fromRev3.state.cadastreVentes, false);
    assert.equal(fromRev3.rev, MAP_LAYERS_STORAGE_REV);

    const fromRev5 = migrateStoredMapLayers(
      { ...DEFAULT_MAP_LAYERS, cadastre: true, cadastreDpe: true },
      5,
    );
    assert.equal(fromRev5.state.cadastre, false);
    assert.equal(fromRev5.state.cadastreDpe, true);
    assert.equal(fromRev5.rev, MAP_LAYERS_STORAGE_REV);
  });
});
