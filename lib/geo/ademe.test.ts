import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapLigneDpe, ademeLinesUrl, parseEtageDepuisComplement } from './ademe';

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
    assert.equal(dpe?.identifiantBan, null);
  });

  it('lit aussi les noms de colonnes normalisés', () => {
    const dpe = mapLigneDpe({
      numero_dpe: 'ABC',
      adresse_ban: '5 avenue des Fleurs',
      code_postal_ban: '44100',
      date_etablissement_dpe: '2026-07-01T00:00:00',
      identifiant_ban: '44100_xxxx_00012',
      numero_etage_appartement: '3',
      etiquette_dpe: 'c',
      surface_habitable_logement: '64,5',
      type_batiment: 'Maison',
    });

    assert.equal(dpe?.numeroDpe, 'ABC');
    assert.equal(dpe?.lettre, 'C');
    assert.equal(dpe?.surfaceM2, 64.5, 'la virgule décimale française doit être lue');
    assert.equal(dpe?.dateEtablissement, '2026-07-01');
    assert.equal(dpe?.identifiantBan, '44100_xxxx_00012');
    assert.equal(dpe?.etage, 3);
  });

  it('lit l’étage dans le complément quand le numéro ADEME vaut 0', () => {
    const dpe = mapLigneDpe({
      numero_dpe: '2675E0044676K',
      adresse_ban: '1 Avenue Taillade 75020 Paris',
      date_etablissement_dpe: '2026-01-08',
      identifiant_ban: '75120_9146_00001',
      numero_etage_appartement: 0,
      complement_adresse_logement: 'Etage 4; Porte Gauche',
      etiquette_dpe: 'E',
    });
    assert.equal(dpe?.etage, 4);
  });

  it('ignore un numéro d’étage à 0 sans complément', () => {
    const dpe = mapLigneDpe({
      numero_dpe: 'ABC',
      adresse_ban: '12 rue X',
      date_etablissement_dpe: '2026-01-08',
      numero_etage_appartement: 0,
    });
    assert.equal(dpe?.etage, null);
  });
});

describe('parseEtageDepuisComplement', () => {
  it('extrait les formulations ADEME courantes', () => {
    assert.equal(parseEtageDepuisComplement('Etage 4; Porte Gauche'), 4);
    assert.equal(parseEtageDepuisComplement('1er étage'), 1);
    assert.equal(parseEtageDepuisComplement('Etage 1'), 1);
    assert.equal(parseEtageDepuisComplement('2e face gauche'), 2);
    assert.equal(parseEtageDepuisComplement('Appartement au 5e étage'), 5);
    assert.equal(parseEtageDepuisComplement('ETAGE 5'), 5);
    assert.equal(parseEtageDepuisComplement('Etage 1 Porte GAUCHE'), 1);
    assert.equal(parseEtageDepuisComplement('RDC'), 0);
    assert.equal(parseEtageDepuisComplement('Etage RDJ; Porte Gauche'), 0);
    assert.equal(parseEtageDepuisComplement('1er étage + S/S (Cave + Box)'), 1);
    assert.equal(parseEtageDepuisComplement('F'), null);
    assert.equal(parseEtageDepuisComplement(null), null);
  });
});

describe('mapLigneDpe — cas limites', () => {
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

describe('ademeLinesUrl', () => {
  it('filtre par _eq / _gte, sans qs (WAF nginx)', () => {
    const url = ademeLinesUrl({ codePostal: '75020', depuis: '2026-08-21', taille: 80 });
    assert.match(url, /code_postal_ban_eq=75020/);
    assert.match(url, /date_etablissement_dpe_gte=2026-08-21/);
    assert.match(url, /select=/);
    assert.doesNotMatch(url, /[?&]qs=/);
  });
});
