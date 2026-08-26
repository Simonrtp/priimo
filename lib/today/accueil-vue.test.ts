import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAccueilVue, phraseEquipe } from './accueil-vue';

describe('parseAccueilVue', () => {
  it('ne prévisualise l’agent que sur la valeur explicite', () => {
    assert.equal(parseAccueilVue('agent'), 'agent');
    assert.equal(parseAccueilVue('directeur'), 'directeur');
    assert.equal(parseAccueilVue(undefined), 'directeur');
  });
});

describe('phraseEquipe', () => {
  it('décrit l’état de l’équipe, pas une pile de tâches', () => {
    assert.equal(phraseEquipe(4), '4 personnes ont un point à regarder cette semaine');
    assert.equal(phraseEquipe(1), '1 personne a un point à regarder cette semaine');
    assert.equal(phraseEquipe(0), 'Rien à signaler cette semaine');
  });
});
