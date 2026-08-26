import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { centroidLngLat } from './parcelle';

describe('centroidLngLat', () => {
  it('moyenne le premier anneau d’un MultiPolygon', () => {
    const c = centroidLngLat({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [3, 50],
            [5, 50],
            [5, 52],
            [3, 52],
            [3, 50],
          ],
        ],
      ],
    });
    assert.ok(c);
    assert.equal(c.longitude, 3.8);
    assert.equal(c.latitude, 50.8);
  });
});
