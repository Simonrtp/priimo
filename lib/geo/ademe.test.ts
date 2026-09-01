import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapLigneDpe } from './ademe';

describe('mapLigneDpe', () => {
  it('lit le millésime aux noms de colonnes accentués', () => {
    const dpe = mapLigneDpe({
      'N°DPE': '2287E0123456X',
      'Adresse_(BAN)': '12 rue de la Paix 44000 Nantes',
      'Code_postal_(BAN)': '44000',
      'Nom__commune_(BAN)': 'Nantes',
      'Date_établissement_DPE': '2026-08-25',
      Etiquette_DPE: 'F',
      Surface_habitable_logement: 82.5,
      'Type_bâtiment': 'Appartement',
    });

    assert.equal(dpe?.numeroDpe, '2287E0123456X');
    assert.equal(dpe?.codePostal, '44000');
    assert.equal(dpe?.lettre, 'F');
    assert.equal(dpe?.surfaceM2, 82.5);
    assert.equal(dpe?.dateEtablissement, '2026-08-25');
  });

  it('lit aussi les noms de colonnes normalisés', () => {
    const dpe = mapLigneDpe({
      numero_dpe: 'ABC',
      adresse_ban: '5 avenue des Fleurs',
      code_postal_ban: '44100',
      date_etablissement_dpe: '2026-07-01T00:00:00',
      etiquette_dpe: 'c',
      surface_habitable_logement: '64,5',
      type_batiment: 'Maison',
    });

    assert.equal(dpe?.numeroDpe, 'ABC');
    assert.equal(dpe?.lettre, 'C');
    assert.equal(dpe?.surfaceM2, 64.5, 'la virgule décimale française doit être lue');
    assert.equal(dpe?.dateEtablissement, '2026-07-01');
  });

  it('rejette une ligne sans identifiant, adresse ou date', () => {
    assert.equal(mapLigneDpe({ 'Adresse_(BAN)': '12 rue X', 'Date_établissement_DPE': '2026-08-01' }), null);
    assert.equal(mapLigneDpe({ 'N°DPE': 'A', 'Date_établissement_DPE': '2026-08-01' }), null);
    assert.equal(mapLigneDpe({ 'N°DPE': 'A', 'Adresse_(BAN)': '12 rue X' }), null);
  });

  it('dégrade une colonne inconnue à null au lieu de casser', () => {
    const dpe = mapLigneDpe({
      'N°DPE': 'A',
      'Adresse_(BAN)': '12 rue X',
      'Date_établissement_DPE': '2026-08-01',
      Etiquette_DPE: 'Z',
      Surface_habitable_logement: 'inconnue',
    });

    assert.equal(dpe?.lettre, null, 'une lettre hors A–G est ignorée');
    assert.equal(dpe?.surfaceM2, null);
    assert.equal(dpe?.typeBatiment, null);
  });

  it('sait lire un _geopoint « lat,lon »', () => {
    const dpe = mapLigneDpe({
      'N°DPE': 'A',
      'Adresse_(BAN)': '12 rue X',
      'Date_établissement_DPE': '2026-08-01',
      _geopoint: '47.2184,-1.5536',
    });

    assert.equal(dpe?.latitude, 47.2184);
    assert.equal(dpe?.longitude, -1.5536);
  });
});
