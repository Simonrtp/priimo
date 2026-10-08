import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prefixeRelation } from './relation';

describe('lien entre deux personnes d’une note', () => {
  it('lit « sœur de Simon » depuis la carte de Christine', () => {
    assert.equal(prefixeRelation('sœur de Simon', { firstName: 'Simon', lastName: 'Ropiot' }), 'Sœur de');
  });

  it('retrouve l’autre par son nom de famille, sans la civilité', () => {
    assert.equal(prefixeRelation('mari de Mme Martin', { firstName: 'Claire', lastName: 'Martin' }), 'Mari de');
  });

  it('ignore une relation qui ne nomme pas l’autre personne', () => {
    assert.equal(prefixeRelation('voisine de Paul', { firstName: 'Simon', lastName: 'Ropiot' }), null);
    assert.equal(prefixeRelation(null, { firstName: 'Simon', lastName: '' }), null);
  });

  it('tolère les accents et la casse', () => {
    assert.equal(prefixeRelation('Fille de Hélène', { firstName: 'helene', lastName: '' }), 'Fille de');
  });
});
