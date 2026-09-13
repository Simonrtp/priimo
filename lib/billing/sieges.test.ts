import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { avertissementSiege, siegesSupplementaires } from './sieges';

describe('sieges', () => {
  it('ne facture rien dans l’inclus', () => {
    assert.equal(siegesSupplementaires(3, 3), 0);
    assert.equal(avertissementSiege({ actifs: 2, inclus: 3, prixSiege: 29 }), null);
  });

  it('prévient dès le premier siège extra', () => {
    const msg = avertissementSiege({ actifs: 3, inclus: 3, prixSiege: 29 });
    assert.match(String(msg), /4e/);
    assert.match(String(msg), /29/);
  });
});
