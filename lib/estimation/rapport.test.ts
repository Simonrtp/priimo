import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exclutConfidentiel, payloadPublic } from './rapport';

describe('rapport d’estimation', () => {
  it('n’embarque jamais le commentaire confidentiel', () => {
    const pub = payloadPublic({
      motif: 'projet_vente',
      dateValeur: null,
      commentairesPublics: 'Bel immeuble pierre.',
      commentairesConfidentiels: 'Le vendeur ment sur les charges.',
    });
    assert.equal(pub.commentaires, 'Bel immeuble pierre.');
    assert.ok(!JSON.stringify(pub).includes('vendeur ment'));
    assert.ok(!JSON.stringify(pub).includes('commentairesConfidentiels'));
    assert.equal(pub.alerteFiabilite, 'Estimation peu fiable');

    const row = exclutConfidentiel({
      id: '1',
      commentaires_publics: 'ok',
      commentaires_confidentiels: 'secret',
    });
    assert.equal('commentaires_confidentiels' in row, false);
  });

  it('porte l’alerte de fiabilité sur le document remis', () => {
    const faible = payloadPublic({
      motif: 'projet_vente',
      dateValeur: null,
      commentairesPublics: null,
      commentairesConfidentiels: null,
      criteresRenseignes: 3,
    });
    assert.equal(faible.alerteFiabilite, 'Estimation peu fiable');

    const suffisant = payloadPublic({
      motif: 'projet_vente',
      dateValeur: null,
      commentairesPublics: null,
      commentairesConfidentiels: null,
      criteresRenseignes: 8,
    });
    assert.equal(suffisant.alerteFiabilite, null);
  });
});
