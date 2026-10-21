import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tachesMiseEnPlace } from './mise-en-place';

describe('tachesMiseEnPlace', () => {
  it('ne propose rien une fois le secteur en place', () => {
    assert.deepEqual(tachesMiseEnPlace({ aUnSecteur: true }), []);
  });

  it('demande le secteur s’il n’est pas dessiné', () => {
    assert.deepEqual(tachesMiseEnPlace({ aUnSecteur: false }), ['secteur']);
  });
});
