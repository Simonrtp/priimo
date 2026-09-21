import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { peutEditerBibliotheque } from './propriete';

describe('bibliothèque de rapport', () => {
  it('réserve l’écriture au directeur', () => {
    assert.equal(peutEditerBibliotheque('directeur'), true);
    assert.equal(peutEditerBibliotheque('collaborateur'), false);
  });
});
