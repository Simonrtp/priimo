import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  directionsRequestUrl,
  formatWalkingDuration,
  googleMapsWalkingUrl,
  ORIGIN_MAX_M,
  routeWaypoints,
} from './directions.js';

const A = { latitude: 48.86, longitude: 2.34 };
const B = { latitude: 48.861, longitude: 2.341 };
const C = { latitude: 48.862, longitude: 2.342 };
const FAR = { latitude: 45.75, longitude: 4.85 };

describe('routeWaypoints', () => {
  it('ajoute le GPS s’il est dans le quartier', () => {
    const origin = { latitude: 48.8602, longitude: 2.3401 };
    const points = routeWaypoints([A, B], origin);
    assert.equal(points.length, 3);
    assert.equal(points[0], origin);
  });

  it('ignore un GPS trop loin', () => {
    const points = routeWaypoints([A, B], FAR);
    assert.deepEqual(points, [A, B]);
    assert.ok(ORIGIN_MAX_M > 0);
  });
});

describe('directionsRequestUrl', () => {
  it('encode lng,lat séparés par des point-virgules', () => {
    const url = directionsRequestUrl([A, B], 'pk.test');
    assert.match(url, /mapbox\/walking\/2\.34,48\.86;2\.341,48\.861\?/);
    assert.match(url, /geometries=geojson/);
    assert.match(url, /access_token=pk\.test/);
  });
});

describe('googleMapsWalkingUrl', () => {
  it('enchaîne origin, waypoints et destination à pied', () => {
    const url = googleMapsWalkingUrl([A, B, C]);
    assert.match(url, /travelmode=walking/);
    assert.match(url, /origin=48\.86%2C2\.34/);
    assert.match(url, /destination=48\.862%2C2\.342/);
    assert.match(url, /waypoints=48\.861%2C2\.341/);
  });
});

describe('formatWalkingDuration', () => {
  it('arrondit à la minute', () => {
    assert.equal(formatWalkingDuration(90), '2 min');
    assert.equal(formatWalkingDuration(10), '1 min');
  });
});
