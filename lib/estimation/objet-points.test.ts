import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pointsVersTexte, texteVersPoints } from './objet';

describe('points texte', () => {
  it('une ligne = un point, puces ignorées', () => {
    assert.deepEqual(texteVersPoints('Lumineux\n- Balcon\n• Travaux\n'), [
      'Lumineux',
      'Balcon',
      'Travaux',
    ]);
  });

  it('revient au texte pour l’édition', () => {
    assert.equal(pointsVersTexte(['Lumineux', 'Balcon']), 'Lumineux\nBalcon');
  });
});
