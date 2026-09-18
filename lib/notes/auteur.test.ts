import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  auteurNote,
  portraitDepuisMembre,
  portraitPourNom,
  portraitsParId,
  portraitsParNom,
} from '@/lib/notes/auteur';

const simon = {
  id: 's1',
  firstName: 'Simon',
  lastName: 'Ropiot',
  fullName: 'Simon Ropiot',
  avatarUrl: '/avatars/loup.png',
};
const marie = {
  id: 'm1',
  firstName: 'Marie',
  lastName: 'Curie',
  fullName: 'Marie Curie',
  avatarUrl: null,
};

describe('portraits collaborateurs', () => {
  it('retrouve un nom malgré la casse et les accents', () => {
    const parNom = portraitsParNom([simon, marie]);
    assert.equal(portraitPourNom('simon ropiot', parNom)?.fullName, 'Simon Ropiot');
    assert.equal(portraitPourNom('Marie Curie', parNom)?.firstName, 'Marie');
    assert.equal(portraitPourNom('12 rue de la Paix', parNom), null);
  });

  it('trouve l’auteur par identifiant', () => {
    const parId = portraitsParId([simon, marie]);
    assert.equal(auteurNote('s1', parId)?.avatarUrl, '/avatars/loup.png');
    assert.equal(auteurNote('inconnu', parId), null);
  });

  it('découpe un nom complet si prénom / nom manquent', () => {
    const p = portraitDepuisMembre({ fullName: 'Simon Ropiot', avatarUrl: null });
    assert.equal(p.firstName, 'Simon');
    assert.equal(p.lastName, 'Ropiot');
  });
});
