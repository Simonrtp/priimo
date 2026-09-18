import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateQrSubmit } from './submit';

describe('saisie QR proprio', () => {
  const base = {
    firstName: 'Marie',
    lastName: 'Martin',
    phone: '06 12 34 56 78',
    email: 'marie@example.fr',
    consentGiven: true,
    consentText: 'ok',
    latitude: null,
    longitude: null,
    gpsPrecisionM: null,
  };

  it('exige un téléphone', () => {
    const res = validateQrSubmit({ ...base, phone: '12' });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.field, 'phone');
  });

  it('exige la case cochée', () => {
    const res = validateQrSubmit({ ...base, consentGiven: false });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.field, 'consent');
  });

  it('accepte une saisie complète', () => {
    const res = validateQrSubmit(base);
    assert.equal(res.ok, true);
    if (res.ok && 'fields' in res) {
      assert.equal(res.fields.firstName, 'Marie');
      assert.equal(res.fields.consentGiven, true);
    }
  });
});
