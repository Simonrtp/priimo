import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyTripOrder,
  MAX_TRIP_COORDS,
  optimizedTripUrl,
  parseOptimizedTrip,
  type OptimizedTrip,
} from './optimized-trip';

const POINTS = [
  { latitude: 48.86, longitude: 2.34 },
  { latitude: 48.861, longitude: 2.341 },
  { latitude: 48.862, longitude: 2.342 },
];

function payload(waypointIndexes: readonly number[]) {
  return {
    code: 'Ok',
    trips: [
      {
        geometry: { type: 'LineString', coordinates: [[2.34, 48.86], [2.342, 48.862]] },
        distance: 1234.5,
        duration: 900,
      },
    ],
    waypoints: waypointIndexes.map((waypoint_index) => ({ waypoint_index })),
  };
}

describe('optimizedTripUrl', () => {
  it('demande une boucle piétonne au départ du premier point', () => {
    const url = optimizedTripUrl(POINTS, 'tok');
    assert.ok(url.startsWith('https://api.mapbox.com/optimized-trips/v1/mapbox/walking/'));
    assert.ok(url.includes('2.34,48.86;2.341,48.861;2.342,48.862'));
    assert.ok(url.includes('roundtrip=true'));
    assert.ok(url.includes('source=first'));
    assert.ok(url.includes('geometries=geojson'));
    assert.ok(url.includes('access_token=tok'));
  });

  it('plafonne au nombre de coordonnées accepté par l’API', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ latitude: 48 + i / 1000, longitude: 2 }));
    const path = optimizedTripUrl(many, 'tok').split('?')[0]!;
    assert.equal(path.split('/').pop()!.split(';').length, MAX_TRIP_COORDS);
  });
});

describe('parseOptimizedTrip', () => {
  it('rend l’ordre de visite, la distance et la durée', () => {
    const trip = parseOptimizedTrip(payload([0, 2, 1]), 3);
    assert.ok(trip);
    assert.deepEqual(trip!.order, [0, 2, 1]);
    assert.equal(trip!.distanceM, 1234.5);
    assert.equal(trip!.durationS, 900);
  });

  it('refuse une réponse en erreur, tronquée ou incohérente', () => {
    assert.equal(parseOptimizedTrip({ code: 'NoTrips' }, 3), null);
    assert.equal(parseOptimizedTrip(payload([0, 1]), 3), null);
    assert.equal(parseOptimizedTrip(payload([0, 1, 1]), 3), null);
    assert.equal(parseOptimizedTrip(payload([0, 1, 9]), 3), null);
    assert.equal(parseOptimizedTrip(null, 3), null);
  });

  it('refuse une géométrie absente', () => {
    assert.equal(parseOptimizedTrip({ code: 'Ok', trips: [{}], waypoints: [] }, 0), null);
  });
});

describe('applyTripOrder', () => {
  const trip = (order: number[]): OptimizedTrip => ({
    geometry: { type: 'LineString', coordinates: [] },
    distanceM: 0,
    durationS: 0,
    order,
  });

  it('réordonne les arrêts sans le départ', () => {
    assert.deepEqual(applyTripOrder(['a', 'b', 'c'], trip([0, 3, 1, 2])), ['c', 'a', 'b']);
  });

  it('refuse un trajet qui ne part pas du départ', () => {
    assert.equal(applyTripOrder(['a', 'b'], trip([1, 0, 2])), null);
  });

  it('refuse un ordre de taille incohérente', () => {
    assert.equal(applyTripOrder(['a', 'b'], trip([0, 1])), null);
  });
});
