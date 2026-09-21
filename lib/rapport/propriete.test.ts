import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ownerPourCreation, peutModifierPage } from './propriete';

describe('propriété des pages de rapport', () => {
  it('l’agent ne touche pas au modèle d’agence', () => {
    assert.equal(peutModifierPage('collaborateur', 'p1', null), false);
    assert.equal(peutModifierPage('collaborateur', 'p1', 'p1'), true);
    assert.equal(peutModifierPage('collaborateur', 'p1', 'p2'), false);
  });

  it('le directeur édite le modèle, pas le rapport d’un autre', () => {
    assert.equal(peutModifierPage('directeur', 'dir', null), true);
    assert.equal(peutModifierPage('directeur', 'dir', 'dir'), true);
    assert.equal(peutModifierPage('directeur', 'dir', 'p1'), false);
  });

  it('la création modèle est réservée au directeur', () => {
    assert.equal(ownerPourCreation('directeur', 'dir', true), null);
    assert.equal(ownerPourCreation('collaborateur', 'p1', true), 'p1');
    assert.equal(ownerPourCreation('directeur', 'dir', false), 'dir');
  });
});
