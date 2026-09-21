import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filtrerCatalogue, ligneRattachementContact } from './rattacher-catalogue';

describe('catalogue de rattachement', () => {
  const items = [
    { id: '1', kind: 'contact' as const, label: 'Marie Durand', subtitle: 'Nantes' },
    { id: '2', kind: 'contact' as const, label: 'Paul Martin', subtitle: '06 12 34 56 78' },
  ];

  it('rend toute la liste sans recherche', () => {
    assert.equal(filtrerCatalogue(items, '').length, 2);
  });

  it('filtre sans tenir compte des accents', () => {
    const hits = filtrerCatalogue(items, 'durànd');
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.id, '1');
  });
});

describe('ligneRattachementContact', () => {
  const philippe = {
    id: 'c1',
    fullName: 'Philippe Martin',
    phone: '06 12 34 56 78',
    address: '12 rue Orfila 75020 Paris',
    banId: '75120_orfila_12',
  };
  const marie = {
    id: 'c2',
    fullName: 'Marie Martin',
    phone: null,
    address: '12 rue Orfila 75020 Paris',
    banId: '75120_orfila_12',
  };
  const voisin = {
    id: 'c3',
    fullName: 'Paul Durand',
    phone: null,
    address: '14 rue Orfila 75020 Paris',
    banId: '75120_orfila_14',
  };

  it('pose le bien et les autres occupants sur la même ligne', () => {
    const ligne = ligneRattachementContact(
      philippe,
      [{ proprietaireContactId: 'c1', address: '12 rue Orfila', banId: '75120_orfila_12' }],
      [philippe, marie, voisin],
    );
    assert.equal(ligne, '12 rue Orfila · Marie Martin');
  });

  it('rattache aussi un bien au même BAN même sans être propriétaire', () => {
    const ligne = ligneRattachementContact(
      marie,
      [{ proprietaireContactId: 'c1', address: '12 rue Orfila', banId: '75120_orfila_12' }],
      [philippe, marie],
    );
    assert.equal(ligne, '12 rue Orfila · Philippe Martin');
  });

  it('revient au téléphone et à l’adresse s’il n’y a pas de rattachement', () => {
    const ligne = ligneRattachementContact(philippe, [], [philippe]);
    assert.equal(ligne, '06 12 34 56 78 · 12 rue Orfila 75020 Paris');
  });
});
