import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashQrToken, isPlausibleQrToken, newQrToken } from './token';
import { fillLegalTemplate, qrLegalSnapshot, sha256Text } from './legal';

describe('jeton QR terrain', () => {
  it('produit un jeton URL-safe assez long', () => {
    const token = newQrToken();
    assert.equal(isPlausibleQrToken(token), true);
    assert.notEqual(token.includes('+'), true);
    assert.notEqual(token.includes('/'), true);
  });

  it('empreint le jeton avec le poivre', () => {
    const a = hashQrToken('abc', 'poivre-a');
    const b = hashQrToken('abc', 'poivre-b');
    assert.equal(a.length, 64);
    assert.notEqual(a, b);
    assert.equal(hashQrToken('abc', 'poivre-a'), a);
  });

  it('rejette un jeton trop court ou sale', () => {
    assert.equal(isPlausibleQrToken('court'), false);
    assert.equal(isPlausibleQrToken('aaaa/bbbbbbbbbbbbbbbbbb'), false);
    assert.equal(isPlausibleQrToken('abcdefghijklmnopqrstuv'), true);
  });
});

describe('mentions QR', () => {
  it('remplit le nom de l’agence dans les deux textes', () => {
    const snap = qrLegalSnapshot({ agenceNom: 'Agence Martin' });
    assert.match(snap.infoText, /Agence Martin/);
    assert.match(snap.consentText, /Agence Martin/);
    assert.equal(snap.consentSha256, sha256Text(snap.consentText));
    assert.doesNotMatch(snap.consentText, /\{agence\}/);
  });

  it('pose le lien d’information dans le texte lu avant la case', () => {
    const text = fillLegalTemplate('Lire {lien_information}', {
      agence: 'X',
      lienInformation: 'https://priimo.fr/information',
    });
    assert.equal(text, 'Lire https://priimo.fr/information');
  });
});
