import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tiltFromMap } from './camera';

describe('tiltFromMap', () => {
  it('relit l’angle courant', () => {
    assert.deepEqual(tiltFromMap({ getPitch: () => 42, getBearing: () => -15 }), {
      pitch: 42,
      bearing: -15,
    });
  });
});
