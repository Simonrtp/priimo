import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COULEURS_MEMBRES, couleurMembreLibre, initialesMembre } from './couleurs-membres';

describe('couleurMembreLibre', () => {
  it('donne la première couleur libre, quelle que soit la casse', () => {
    assert.equal(couleurMembreLibre([]), COULEURS_MEMBRES[0]);
    assert.equal(couleurMembreLibre([COULEURS_MEMBRES[0].toLowerCase()]), COULEURS_MEMBRES[1]);
  });

  it('reste unique au-delà de la palette, sans l’orange des leads ni le bleu de l’IA', () => {
    const prises: string[] = [];
    for (let i = 0; i < 30; i += 1) prises.push(couleurMembreLibre(prises));
    assert.equal(new Set(prises).size, 30);
    assert.ok(!prises.includes('#E8743C'));
    assert.ok(!prises.includes('#6366F1'));
  });
});

describe('initialesMembre', () => {
  it('prénom et nom, ou deux lettres d’un seul mot', () => {
    assert.equal(initialesMembre('Simon', 'Ropiot'), 'SR');
    assert.equal(initialesMembre('nicolas', null), 'NI');
    assert.equal(initialesMembre('', ''), '');
  });
});
