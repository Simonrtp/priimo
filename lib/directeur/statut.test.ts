import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ordreStatutNegociateur, statutNegociateur } from './statut';

describe('statutNegociateur', () => {
  it('renvoie Nouveau sous 4 semaines d’historique', () => {
    assert.equal(
      statutNegociateur({
        activiteRecente: 0,
        moyenneHebdo4Semaines: null,
        semainesHistorique: 3,
      }),
      'nouveau',
    );
  });

  it('renvoie En avance au-dessus de 120 %', () => {
    assert.equal(
      statutNegociateur({
        activiteRecente: 13,
        moyenneHebdo4Semaines: 10,
        semainesHistorique: 4,
      }),
      'en_avance',
    );
  });

  it('renvoie Dans le rythme entre 60 % et 120 %', () => {
    assert.equal(
      statutNegociateur({
        activiteRecente: 8,
        moyenneHebdo4Semaines: 10,
        semainesHistorique: 4,
      }),
      'dans_le_rythme',
    );
  });

  it('renvoie À voir sous 60 %', () => {
    assert.equal(
      statutNegociateur({
        activiteRecente: 5,
        moyenneHebdo4Semaines: 10,
        semainesHistorique: 4,
      }),
      'a_voir',
    );
  });

  it('place À voir avant les autres pour le tri', () => {
    assert.ok(ordreStatutNegociateur('a_voir') < ordreStatutNegociateur('nouveau'));
    assert.ok(ordreStatutNegociateur('nouveau') < ordreStatutNegociateur('dans_le_rythme'));
    assert.ok(ordreStatutNegociateur('dans_le_rythme') < ordreStatutNegociateur('en_avance'));
  });
});
