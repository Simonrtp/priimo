import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detecterFichier, kindDepuisMime, nomFichierPropre, reordonnerIds } from './pages';

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

  it('reconnaît un PDF même sans MIME Windows', () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    assert.deepEqual(detecterFichier({ type: '', name: 'plaquette.pdf' }, pdf), {
      mime: 'application/pdf',
      kind: 'pdf',
    });
    assert.deepEqual(detecterFichier({ type: '', name: 'plaquette.pdf' }, new Uint8Array([0, 1, 2])), {
      mime: 'application/pdf',
      kind: 'pdf',
    });
    assert.equal(detecterFichier({ type: '', name: 'notes.txt' }, new Uint8Array([1, 2, 3])), null);
  });
});
