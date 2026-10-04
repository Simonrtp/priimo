import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lienReinitialisation, messageErreurMotDePasse, verifierNouveauMotDePasse } from './mot-de-passe';

describe('verifierNouveauMotDePasse', () => {
  it('exige 8 caractères et deux saisies identiques', () => {
    assert.equal(verifierNouveauMotDePasse('court', 'court'), 'Au moins 8 caractères.');
    assert.equal(verifierNouveauMotDePasse('assez-long', 'assez-lonG'), 'Les deux mots de passe ne correspondent pas.');
    assert.equal(verifierNouveauMotDePasse('assez-long', 'assez-long'), null);
  });

  it('refuse ce que bcrypt tronquerait', () => {
    const long = 'é'.repeat(40); // 80 octets
    assert.equal(verifierNouveauMotDePasse(long, long), 'Trop long : 72 caractères au plus.');
  });
});

describe('messageErreurMotDePasse', () => {
  it('dit qu’un mot de passe a fuité', () => {
    assert.match(messageErreurMotDePasse({ code: 'weak_password', reasons: ['pwned'] }), /fuites de données/);
    assert.match(messageErreurMotDePasse({ code: 'weak_password', reasons: ['length'] }), /trop faible/);
  });

  it('reconnaît l’ancien mot de passe et l’excès de tentatives', () => {
    assert.match(messageErreurMotDePasse({ code: 'same_password' }), /actuel/);
    assert.match(messageErreurMotDePasse({ code: 'over_request_rate_limit' }), /Trop de tentatives/);
    assert.match(messageErreurMotDePasse(null), /n’a pas pu/);
  });
});

describe('lienReinitialisation', () => {
  it('pointe vers le formulaire, jeton encodé', () => {
    assert.equal(
      lienReinitialisation('https://priimo.fr/', 'ab+c/d'),
      'https://priimo.fr/mot-de-passe/nouveau?jeton=ab%2Bc%2Fd',
    );
  });
});
