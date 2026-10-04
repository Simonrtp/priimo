import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PLAFONDS_IA_JOUR, quotaIndisponible } from './quota-regles';

describe('quotaIndisponible', () => {
  it('reconnaît une fonction pas encore déployée', () => {
    assert.equal(quotaIndisponible({ code: 'PGRST202', message: 'Could not find the function public.ia_reserver' }), true);
    assert.equal(quotaIndisponible({ code: '42883', message: 'function ia_reserver does not exist' }), true);
    assert.equal(quotaIndisponible({ code: '57014', message: 'canceling statement due to statement timeout' }), false);
    assert.equal(quotaIndisponible(null), false);
  });
});

describe('PLAFONDS_IA_JOUR', () => {
  it('reste loin au-dessus de l’usage mesuré (6 par agent et par jour)', () => {
    for (const plafond of Object.values(PLAFONDS_IA_JOUR)) assert.ok(plafond >= 100);
  });
});
