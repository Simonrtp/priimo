import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  etapeAccessible,
  etapeBienOk,
  etapeClientOk,
  etapeInitiale,
  indexDepuisDonnees,
  indexMaxAccessible,
  manquesEtape,
} from './etapes';

const vide = {
  contactId: null,
  address: null,
  propertyType: null,
  surfaceM2: null,
  rooms: null,
  priceValue: null,
} as const;

describe('étapes atelier', () => {
  it('bloque le client tant qu’aucun contact n’est rattaché', () => {
    assert.equal(etapeClientOk(vide), false);
    assert.equal(manquesEtape(vide as never, 'client'), 'Rattachez ou créez un client pour continuer.');
  });

  it('exige adresse, type, surface et pièces pour le bien', () => {
    assert.equal(etapeBienOk({ ...vide, address: '12 rue X', propertyType: 'appartement' }), false);
    assert.equal(
      etapeBienOk({
        address: '12 rue X',
        propertyType: 'appartement',
        surfaceM2: 65,
        rooms: 3,
      }),
      true,
    );
  });

  it('une estimation neuve commence au client', () => {
    assert.equal(etapeInitiale(vide as never), 'client');
    assert.equal(indexDepuisDonnees(vide as never), 0);
  });

  it('interdit de sauter à l’estimation si le bien n’est pas rempli', () => {
    const avecClient = { ...vide, contactId: 'c1' };
    assert.equal(indexMaxAccessible(avecClient as never, 0), 1);
    assert.ok(indexMaxAccessible(avecClient as never, 0) < 3);
  });

  it('déverrouille tout une fois la valeur calculée', () => {
    const complete = {
      contactId: 'c1',
      address: '12 rue X',
      propertyType: 'maison' as const,
      surfaceM2: 90,
      rooms: 4,
      priceValue: 320000,
    };
    assert.equal(indexMaxAccessible(complete as never, 0), 4);
  });

  it('laisse le rapport accessible même si l’estimation n’est pas finie', () => {
    assert.equal(etapeAccessible(vide as never, 0, 'rapport'), true);
    assert.equal(etapeAccessible(vide as never, 0, 'bien'), false);
    assert.equal(etapeAccessible(vide as never, 0, 'estimation'), false);
  });
});
