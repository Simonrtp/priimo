import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { centroidLngLat, contenanceDepuisProps, surfaceCadastreM2 } from './parcelle';

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

describe('surfaceCadastreM2', () => {
  it('approxime un carré d’environ 100 m de côté', () => {
    const lat = 48.85;
    const dLng = 100 / (111_320 * Math.cos((lat * Math.PI) / 180));
    const dLat = 100 / 110_540;
    const s = surfaceCadastreM2({
      type: 'Polygon',
      coordinates: [
        [
          [2, lat],
          [2 + dLng, lat],
          [2 + dLng, lat + dLat],
          [2, lat + dLat],
          [2, lat],
        ],
      ],
    });
    assert.ok(s);
    assert.ok(s > 9000 && s < 11000);
  });
});

describe('contenanceDepuisProps', () => {
  it('lit la contenance IGN', () => {
    assert.equal(contenanceDepuisProps({ contenance: 342 }), 342);
    assert.equal(contenanceDepuisProps({ contenance: '1 250' }), null);
    assert.equal(contenanceDepuisProps({ contenance: '1250' }), 1250);
  });
});
