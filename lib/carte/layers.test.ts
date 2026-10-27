import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_MAP_LAYERS,
  MAP_LAYER_ORDER,
  MAP_LAYERS_STORAGE_REV,
  migrateStoredMapLayers,
  parseMapLayers,
  showParcellesPlan,
  withCadastreLayerToggled,
  withDpeAgeSpan,
} from './layers';

describe('parseMapLayers', () => {
  it('active le plan parcellaire et masque les biens par défaut', () => {
    assert.equal(parseMapLayers(null).cadastre, true);
    assert.equal(DEFAULT_MAP_LAYERS.cadastre, true);
    assert.equal(DEFAULT_MAP_LAYERS.bien, false);
    assert.equal(DEFAULT_MAP_LAYERS.cadastreDpe, false);
    assert.equal(DEFAULT_MAP_LAYERS.cadastreVentes, false);
    assert.equal(DEFAULT_MAP_LAYERS.cadastreCopro, false);
    assert.equal(DEFAULT_MAP_LAYERS.cadastreMenuOpen, false);
    assert.equal(DEFAULT_MAP_LAYERS.annonces, false);
  });

  it('ne propose plus Biens dans les filtres', () => {
    assert.ok(!MAP_LAYER_ORDER.includes('bien'));
    assert.equal(parseMapLayers({ bien: true }).bien, false);
  });

  it('force toujours les parcelles, même si le stockage les avait éteintes', () => {
    assert.equal(parseMapLayers({ lead: false, parcelles: false, cadastre: false }).cadastre, true);
    assert.equal(parseMapLayers({ cadastre: true, cadastreDpe: true }).cadastreDpe, true);
  });

  it('ne couple plus Parcelles et Diagnostics', () => {
    assert.equal(parseMapLayers({ cadastre: true }).cadastreDpe, false);
    const next = withCadastreLayerToggled(
      { ...DEFAULT_MAP_LAYERS, cadastre: true, cadastreDpe: false },
      'parcelles',
    );
    assert.equal(next.cadastre, true);
    assert.equal(next.cadastreDpe, false);
  });

  it('affiche toujours le plan parcellaire', () => {
    assert.equal(showParcellesPlan(DEFAULT_MAP_LAYERS), true);
    assert.equal(showParcellesPlan({ ...DEFAULT_MAP_LAYERS, cadastre: false }), true);
    assert.equal(showParcellesPlan({ ...DEFAULT_MAP_LAYERS, cadastreDpe: true }), true);
  });

  it('persiste la plage d’ancienneté du curseur', () => {
    const parsed = parseMapLayers({ cadastreDpeAges: ['semaine', '3+'] });
    assert.deepEqual(parsed.cadastreDpeAges, ['semaine', '3+']);
    assert.deepEqual(withDpeAgeSpan(parsed, 1, 3).cadastreDpeAges, ['semaine', 'mois', '1-6']);
  });

  it('persiste l’état du menu Cadastre', () => {
    assert.equal(parseMapLayers({}).cadastreMenuOpen, false);
    assert.equal(parseMapLayers({ cadastreMenuOpen: true }).cadastreMenuOpen, true);
    assert.equal(parseMapLayers({ cadastreMenuOpen: false }).cadastreMenuOpen, false);
  });

  it('reprend toutes les cases d’ancienneté si absentes', () => {
    assert.equal(parseMapLayers({}).cadastreDpeAges.length, 7);
  });

  it('rev 6 éteint le plan (et les pastilles si rev < 5), puis rev 10 le rallume', () => {
    const fromRev3 = migrateStoredMapLayers(
      { ...DEFAULT_MAP_LAYERS, cadastre: true, cadastreDpe: true, cadastreVentes: true },
      3,
    );
    assert.equal(fromRev3.state.cadastre, true);
    assert.equal(fromRev3.state.cadastreDpe, false);
    assert.equal(fromRev3.state.cadastreVentes, false);
    assert.equal(fromRev3.state.bien, false);
    assert.equal(fromRev3.rev, MAP_LAYERS_STORAGE_REV);

    const fromRev5 = migrateStoredMapLayers(
      { ...DEFAULT_MAP_LAYERS, cadastre: true, cadastreDpe: true },
      5,
    );
    assert.equal(fromRev5.state.cadastre, true);
    assert.equal(fromRev5.state.cadastreDpe, true);
    assert.equal(fromRev5.rev, MAP_LAYERS_STORAGE_REV);
  });

  it('rev 7 éteint « Mon secteur » des annonces sans toucher au cadastre', () => {
    const fromRev6 = migrateStoredMapLayers(
      { ...DEFAULT_MAP_LAYERS, cadastre: true, annoncesMonSecteur: true, annonces: true },
      6,
    );
    assert.equal(fromRev6.state.annoncesMonSecteur, false);
    assert.equal(fromRev6.state.annonces, false);
    assert.equal(fromRev6.state.cadastre, true);
    assert.equal(fromRev6.rev, MAP_LAYERS_STORAGE_REV);
  });

  it('rev 9 masque les annonces et replie Cadastre', () => {
    const fromRev8 = migrateStoredMapLayers(
      { ...DEFAULT_MAP_LAYERS, annonces: true, annoncesMenuOpen: true, cadastreMenuOpen: true },
      8,
    );
    assert.equal(fromRev8.state.annonces, false);
    assert.equal(fromRev8.state.annoncesMenuOpen, false);
    assert.equal(fromRev8.state.cadastreMenuOpen, false);
    assert.equal(fromRev8.state.cadastre, true);
    assert.equal(fromRev8.rev, MAP_LAYERS_STORAGE_REV);
  });

  it('rev 10 force les parcelles et retire les biens', () => {
    const fromRev9 = migrateStoredMapLayers(
      { ...DEFAULT_MAP_LAYERS, cadastre: false, bien: true },
      9,
    );
    assert.equal(fromRev9.state.cadastre, true);
    assert.equal(fromRev9.state.bien, false);
    assert.equal(fromRev9.rev, MAP_LAYERS_STORAGE_REV);
  });

  it('rev 8 retire la couche Copropriétés sans toucher au reste', () => {
    const fromRev7 = migrateStoredMapLayers(
      { ...DEFAULT_MAP_LAYERS, cadastre: true, cadastreCopro: true, cadastreVentes: true },
      7,
    );
    assert.equal(fromRev7.state.cadastreCopro, false);
    assert.equal(fromRev7.state.cadastre, true);
    assert.equal(fromRev7.state.cadastreVentes, true);
    assert.equal(fromRev7.rev, MAP_LAYERS_STORAGE_REV);
    assert.equal(parseMapLayers({ cadastreCopro: true }).cadastreCopro, false);
  });

  it('convertit les anciens réglages des annonces', () => {
    const ancien = parseMapLayers({ annoncesActives: true, annoncesParticuliers: false, annoncesDpe: 'F' });
    assert.equal(ancien.annonces, true);
    assert.equal(ancien.annoncesVendeur, 'tous');
    assert.equal(ancien.annoncesStatut, 'actives');
    assert.equal(ancien.annoncesDpe, 'F');
    const baisse = parseMapLayers({ annoncesBaisse: true });
    assert.equal(baisse.annonces, true);
    assert.equal(baisse.annoncesStatut, 'baisse');
    assert.equal(baisse.annoncesVendeur, 'particulier');
    assert.equal(parseMapLayers({ annoncesRetirees: true }).annoncesStatut, 'retirees');
    assert.equal(parseMapLayers({}).annonces, false);
  });

  it('lit le nouveau modèle des annonces', () => {
    const lu = parseMapLayers({ annonces: false, annoncesVendeur: 'professionnel', annoncesStatut: 'nouvelles', annoncesDpe: 'fgx' });
    assert.equal(lu.annonces, false);
    assert.equal(lu.annoncesVendeur, 'professionnel');
    assert.equal(lu.annoncesStatut, 'nouvelles');
    assert.equal(lu.annoncesDpe, 'FG');
    assert.equal(parseMapLayers({ annoncesVendeur: 'n’importe' }).annoncesVendeur, 'particulier');
  });
});
