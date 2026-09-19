import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { kindDepuisMime, nomFichierPropre, reordonnerIds } from './pages';

describe('pages de rapport', () => {
  it('classe le mime', () => {
    assert.equal(kindDepuisMime('application/pdf'), 'pdf');
    assert.equal(kindDepuisMime('image/jpeg'), 'image');
    assert.equal(kindDepuisMime('text/plain'), null);
  });

  it('réordonne sans perdre d’identifiant', () => {
    assert.deepEqual(reordonnerIds(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
    assert.deepEqual(reordonnerIds(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
    assert.deepEqual(reordonnerIds(['a', 'b'], 1, 1), ['a', 'b']);
  });

  it('nettoie le nom de fichier', () => {
    assert.equal(nomFichierPropre('plaquette.pdf'), 'plaquette');
    assert.equal(nomFichierPropre('  '), 'Page');
  });
});
