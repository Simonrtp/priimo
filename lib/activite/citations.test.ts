import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { citationDuJour } from './citations';

describe('citationDuJour', () => {
  it('reste la même toute la journée', () => {
    const a = citationDuJour({ jour: '2026-09-08', prenoms: ['Camille', 'Thomas'] });
    const b = citationDuJour({ jour: '2026-09-08', prenoms: ['Camille', 'Thomas'] });
    assert.equal(a, b);
    assert.ok(a.length > 10);
  });

  it('change d’un jour à l’autre', () => {
    const lundi = citationDuJour({ jour: '2026-09-07', prenoms: ['Camille', 'Thomas', 'Léa'] });
    const mardi = citationDuJour({ jour: '2026-09-08', prenoms: ['Camille', 'Thomas', 'Léa'] });
    assert.notEqual(lundi, mardi);
  });

  it('cite un prénom quand il y en a', () => {
    const texte = citationDuJour({ jour: '2026-09-09', prenoms: ['Simon'] });
    assert.match(texte, /Simon|régularité|immeuble|terrain|journée/i);
  });

  it('ne cite jamais un collègue : seulement le premier prénom', () => {
    const texte = citationDuJour({
      jour: '2026-09-08',
      prenoms: ['Simon', 'Camille', 'Thomas'],
    });
    assert.doesNotMatch(texte, /Camille|Thomas/);
  });
});
