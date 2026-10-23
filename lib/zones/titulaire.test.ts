import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { messageSecteurUnique, secteurDejaTenu } from './titulaire';

const zones = [
  { id: 'a', assignedTo: 'camille', actif: true },
  { id: 'b', assignedTo: 'camille', actif: false },
  { id: 'c', assignedTo: null, actif: true },
];

describe('secteurDejaTenu', () => {
  it('compte un secteur actif du même agent', () => {
    assert.equal(secteurDejaTenu(zones, 'camille'), true);
    assert.equal(secteurDejaTenu(zones, 'louis'), false);
  });

  it('ignore le secteur en cours et un secteur éteint', () => {
    assert.equal(secteurDejaTenu(zones, 'camille', 'a'), false);
    assert.equal(secteurDejaTenu([{ id: 'b', assignedTo: 'camille', actif: false }], 'camille'), false);
  });
});

describe('messageSecteurUnique', () => {
  it('parle à l’agent, ou du titulaire', () => {
    assert.equal(messageSecteurUnique(true), 'Vous avez déjà un secteur.');
    assert.equal(messageSecteurUnique(false), 'Cet agent a déjà un secteur.');
  });
});
