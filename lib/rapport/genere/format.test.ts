import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatDateCourte,
  formatEuro,
  formatPrixM2,
  formatSurface,
  libelleEtatBien,
  memeContact,
  nomPersonne,
} from './format';

describe('formatage avis de valeur', () => {
  it('écrit 546 000 € avec espaces insécables', () => {
    const s = formatEuro(546000);
    assert.equal(s.includes('546'), true);
    assert.equal(s.includes('000'), true);
    assert.equal(s.includes('€'), true);
    assert.equal(s.replace(/\D/g, ''), '546000');
    assert.match(s, /\u202f|\u00a0/);
    assert.doesNotMatch(s, /546000/);
  });

  it('écrit la surface avec m²', () => {
    assert.equal(formatSurface(76).endsWith('m²'), true);
    assert.doesNotMatch(formatSurface(76), /m2$/);
  });

  it('nomme l’état du bien', () => {
    assert.equal(libelleEtatBien({ conditionRating: 3, etatGeneral: 1 }), 'Bon état');
    assert.equal(libelleEtatBien({ conditionRating: null, etatGeneral: 4 }), 'Bon');
    assert.equal(libelleEtatBien({ conditionRating: null, etatGeneral: null }), null);
  });

  it('écrit le prix au m²', () => {
    const s = formatPrixM2(7579);
    assert.match(s, /€\/m²/);
    assert.doesNotMatch(s, /7579(?!\d)/);
  });

  it('met les noms en capitale initiale', () => {
    assert.equal(nomPersonne('marie DURAND'), 'Marie Durand');
    assert.equal(nomPersonne('jean-luc martin'), 'Jean-Luc Martin');
    assert.equal(nomPersonne('  '), null);
  });

  it('date en lettres abrégées', () => {
    const s = formatDateCourte('2026-09-12');
    assert.ok(s);
    assert.match(s, /2026/);
    assert.doesNotMatch(s, /09\/12/);
  });

  it('détecte les coordonnées identiques', () => {
    assert.equal(memeContact('06 12 34 56 78', '0612345678'), true);
    assert.equal(memeContact('a@b.fr', 'A@B.FR'), true);
    assert.equal(memeContact('a@b.fr', 'c@d.fr'), false);
  });
});
