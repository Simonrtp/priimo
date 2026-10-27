import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { avertissementSiege, siegesSupplementaires } from './sieges';

describe('sieges', () => {
  it('calcule les extras sans message', () => {
    assert.equal(siegesSupplementaires(3, 3), 0);
    assert.equal(siegesSupplementaires(5, 3), 2);
  });

  it('n’avertit jamais : invitations libres pour l’instant', () => {
    assert.equal(avertissementSiege({ actifs: 2, inclus: 3 }), null);
    assert.equal(avertissementSiege({ actifs: 14, inclus: 5 }), null);
  });
});
