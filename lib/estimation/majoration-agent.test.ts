import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { majorationDepuisPrix, prixAvecMajoration } from './majoration-agent';

describe('majoration agent', () => {
  it('ajuste le prix moteur de −10 % à +10 %, au dixième', () => {
    assert.equal(prixAvecMajoration(400_000, 0), 400_000);
    assert.equal(prixAvecMajoration(400_000, 10), 440_000);
    assert.equal(prixAvecMajoration(400_000, -4), 384_000);
    assert.equal(prixAvecMajoration(400_000, 1.3), 405_200);
  });

  it('retrouve le pourcentage si le prix reste dans la fourchette', () => {
    assert.equal(majorationDepuisPrix(400_000, 405_200), 1.3);
    assert.equal(majorationDepuisPrix(400_000, 200_000), null);
  });
});
