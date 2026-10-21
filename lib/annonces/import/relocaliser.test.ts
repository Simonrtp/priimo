import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { requetesDpe } from './localiser';
import { ficheDepuisLigne } from './relocaliser';

describe('relocalisation nocturne', () => {
  const ligne = {
    id: 'a1',
    portail: 'seloger',
    id_portail: '26APZHCVQ116',
    url: 'https://www.seloger.com/annonce/x/26APZHCVQ116',
    type_vendeur: 'professionnel',
    type_bien: 'appartement',
    prix: 1870000,
    surface: '187',
    etage: 1,
    dpe: 'F',
    conso_kwh_m2: 351,
    ges: 'F',
    ges_kg_m2: '70',
    code_postal: '75017',
    quartier: 'Pereire-Malesherbes',
    latitude: 48.88503,
    longitude: 2.30136,
    localisation_precision: 'quartier',
    publiee_le: '2026-10-19T08:53:00Z',
  };

  it('rebâtit la fiche d’une annonce gardée en base, quartier compris', () => {
    const f = ficheDepuisLigne(ligne);
    assert.equal(f.surface, 187);
    assert.equal(f.gesKgM2, 70);
    assert.equal(f.consoKwhM2, 351);
    assert.deepEqual(f.zone, { latitude: 48.88503, longitude: 2.30136, rayonM: 350 });
  });

  it('cherche à nouveau dans le quartier et tout le code postal', () => {
    const portees = requetesDpe(ficheDepuisLigne(ligne)).map((r) => r.portee);
    assert.deepEqual(portees, ['zone', 'zone', 'code_postal', 'code_postal']);
  });

  it('un code postal entier n’est pas un repère', () => {
    assert.equal(ficheDepuisLigne({ ...ligne, localisation_precision: 'code_postal' }).zone, null);
  });
});
