import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findPostalCollisions } from './postal-collisions';

describe('findPostalCollisions', () => {
  const agencies = [
    { id: 'a1', name: 'Century 21 Quartier Latin', codes_postaux: ['75005'] },
    { id: 'a2', name: 'Agence test', codes_postaux: ['75020'] },
  ];

  it('détecte un code déjà attribué', () => {
    const hits = findPostalCollisions(['75005'], agencies);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]!.agencyName, 'Century 21 Quartier Latin');
  });

  it('aucune collision pour un code libre', () => {
    assert.equal(findPostalCollisions(['69001'], agencies).length, 0);
  });
});
