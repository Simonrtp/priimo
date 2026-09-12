import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { citationDuJour, MODELES_CITATION } from './citations';

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

  it('ne tutoyait jamais l’agent, ni un collègue', () => {
    const texte = citationDuJour({
      jour: '2026-09-08',
      prenoms: ['Simon', 'Camille', 'Thomas'],
    });
    assert.doesNotMatch(texte, /Camille|Thomas|Simon/);
    assert.doesNotMatch(texte, /\b[Tt]u\b|\btiens le cap\b/i);
  });

  it('reste sobre : pas de tutoiement, pas de promesse de mandat', () => {
    for (const modele of MODELES_CITATION) {
      const texte = modele.texte();
      assert.ok(texte.length > 10);
      assert.doesNotMatch(texte, /\b[Tt]u\b|\btiens le cap\b|mandats de demain/i);
    }
  });
});
