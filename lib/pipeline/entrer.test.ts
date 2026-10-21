import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deciderEntree, noteDepuisAnnonce } from './entrer.js';

describe('deciderEntree', () => {
  it('crée quand aucune fiche n’existe à l’adresse', () => {
    assert.deepEqual(deciderEntree([]), { action: 'creer' });
  });

  it('prend le lead libre au score le plus haut', () => {
    const choix = deciderEntree([
      { id: 'bas', stageId: null, score: 20 },
      { id: 'haut', stageId: null, score: 80 },
      { id: 'pris', stageId: 's1', score: 90 },
    ]);
    assert.equal(choix.action, 'prendre');
    if (choix.action === 'prendre') assert.equal(choix.lead.id, 'haut');
  });

  it('dit déjà au pipeline quand toutes les fiches y sont', () => {
    const choix = deciderEntree([
      { id: 'a', stageId: 's1', score: 10 },
      { id: 'b', stageId: 's2', score: 40 },
    ]);
    assert.equal(choix.action, 'deja');
    if (choix.action === 'deja') assert.equal(choix.lead.id, 'b');
  });
});

describe('noteDepuisAnnonce', () => {
  it('nomme le portail et le prix', () => {
    assert.match(noteDepuisAnnonce('pap', 538000), /^Annonce PAP · 538.000 €$/);
  });

  it('reste lisible sans prix', () => {
    assert.equal(noteDepuisAnnonce('seloger', null), 'Annonce SeLoger');
  });
});
