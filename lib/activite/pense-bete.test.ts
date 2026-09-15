import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PENSE_BETE_MAX,
  ecrirePenseBete,
  lirePenseBete,
} from './pense-bete';

describe('lirePenseBete', () => {
  it('lit le texte dans les préférences', () => {
    assert.equal(lirePenseBete({ penseBete: 'Rappeler Martin' }), 'Rappeler Martin');
  });

  it('renvoie vide si rien n’est posé', () => {
    assert.equal(lirePenseBete({}), '');
    assert.equal(lirePenseBete(null), '');
    assert.equal(lirePenseBete({ penseBete: 12 }), '');
  });
});

describe('ecrirePenseBete', () => {
  it('conserve les autres préférences', () => {
    const suivant = ecrirePenseBete({ newLeads: true, penseBete: 'ancien' }, 'nouveau');
    assert.equal(suivant.newLeads, true);
    assert.equal(suivant.penseBete, 'nouveau');
  });

  it('coupe au maximum', () => {
    const trop = 'a'.repeat(PENSE_BETE_MAX + 40);
    const suivant = ecrirePenseBete({}, trop);
    assert.equal(String(suivant.penseBete).length, PENSE_BETE_MAX);
  });
});
