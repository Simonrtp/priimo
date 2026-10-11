import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ADDRESS_ACCURACY_MAX_M, isAddressPositionPrecise } from './gps';

describe('précision GPS pour une adresse', () => {
  it('accepte seulement un point assez précis pour choisir un numéro', () => {
    assert.equal(isAddressPositionPrecise({ accuracyM: 8 }), true);
    assert.equal(isAddressPositionPrecise({ accuracyM: ADDRESS_ACCURACY_MAX_M }), true);
    assert.equal(isAddressPositionPrecise({ accuracyM: ADDRESS_ACCURACY_MAX_M + 1 }), false);
    assert.equal(isAddressPositionPrecise({ accuracyM: null }), false);
  });
});
