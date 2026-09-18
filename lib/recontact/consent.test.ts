import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estNumeroConsenti, NUMERO_NON_CONSENTI } from './consent';
import { actionJoindre } from './action';

describe('numéro appelable', () => {
  it('sans horodatage, le numéro n’est pas consenti', () => {
    assert.equal(estNumeroConsenti(null), false);
    assert.equal(estNumeroConsenti(undefined), false);
    assert.equal(estNumeroConsenti('2026-09-18T12:00:00.000Z'), true);
    assert.equal(NUMERO_NON_CONSENTI, 'numéro non consenti');
  });

  it('sans consentement, le CTA ouvre la fiche au lieu d’appeler', () => {
    const locked = actionJoindre({
      phone: '0612345678',
      consenti: false,
      contactId: 'c1',
      labelAppeler: 'Appeler Marie',
      labelFiche: 'Ouvrir la fiche',
    });
    assert.equal(locked.kind, 'ouvrir_contact');
    const open = actionJoindre({
      phone: '0612345678',
      consenti: true,
      contactId: 'c1',
      labelAppeler: 'Appeler Marie',
      labelFiche: 'Ouvrir la fiche',
    });
    assert.equal(open.kind, 'appeler');
  });
});
