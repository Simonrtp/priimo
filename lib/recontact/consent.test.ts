import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { actionJoindre } from './action';

describe('numéro appelable', () => {
  it('un numéro ouvre l’appel, sans accord préalable', () => {
    const call = actionJoindre({
      phone: '0612345678',
      contactId: 'c1',
      labelAppeler: 'Appeler Marie',
      labelFiche: 'Ouvrir la fiche',
    });
    assert.equal(call.kind, 'appeler');
  });

  it('sans numéro, le CTA ouvre la fiche', () => {
    const open = actionJoindre({
      phone: null,
      contactId: 'c1',
      labelAppeler: 'Appeler Marie',
      labelFiche: 'Ouvrir la fiche',
    });
    assert.equal(open.kind, 'ouvrir_contact');
  });
});
