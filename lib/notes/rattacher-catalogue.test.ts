import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filtrerCatalogue } from './rattacher-catalogue';

describe('catalogue de rattachement', () => {
  const items = [
    { id: '1', kind: 'contact' as const, label: 'Marie Durand', subtitle: 'Nantes' },
    { id: '2', kind: 'contact' as const, label: 'Paul Martin', subtitle: '06 12 34 56 78' },
  ];

  it('rend toute la liste sans recherche', () => {
    assert.equal(filtrerCatalogue(items, '').length, 2);
  });

  it('filtre sans tenir compte des accents', () => {
    const hits = filtrerCatalogue(items, 'durànd');
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.id, '1');
  });
});
