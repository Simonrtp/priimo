import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clusterBuildings, clusterMapPoints, pointDisplayCoord, type ClusteredGroup } from './cluster';
import type { MapPoint } from './points';

function point(partial: Partial<MapPoint> & Pick<MapPoint, 'id' | 'latitude' | 'longitude'>): MapPoint {
  return {
    kind: 'lead',
    recordId: partial.id,
    banId: `ban-${partial.id}`,
    postalCode: '59000',
    title: partial.id,
    subtitle: '',
    href: '/',
    color: '#E8743C',
    badge: '80',
    assignedTo: null,
    occurredAt: '2026-08-01T00:00:00.000Z',
    ...partial,
  };
}

describe('clusterMapPoints', () => {
  it('laisse chaque prospect visible, même dézoomé', () => {
    const items = clusterMapPoints(
      [
        point({ id: 'a', latitude: 50.63, longitude: 3.06 }),
        point({ id: 'b', latitude: 50.6302, longitude: 3.0602 }),
      ],
      11,
    );
    assert.equal(items.length, 2);
    assert.equal(items.every((item) => item.kind === 'point'), true);
  });

  it('regroupe seulement les contacts et biens voisins', () => {
    const items = clusterMapPoints(
      [
        point({ id: 'c1', latitude: 50.63, longitude: 3.06, kind: 'contact' }),
        point({ id: 'c2', latitude: 50.6302, longitude: 3.0602, kind: 'contact' }),
        point({ id: 'lead', latitude: 50.63, longitude: 3.06, kind: 'lead' }),
      ],
      11,
    );
    const clusters = items.filter((item) => item.kind === 'cluster');
    const singles = items.filter((item) => item.kind === 'point');
    assert.equal(clusters.length, 1);
    assert.equal((clusters[0] as ClusteredGroup).count, 2);
    assert.equal(singles.length, 1);
    assert.equal(singles[0]?.kind === 'point' && singles[0].point.kind, 'lead');
  });
});

describe('pointDisplayCoord', () => {
  it('décale contact et bien pour ne pas les empiler sur le prospect', () => {
    const lead = point({ id: 'l', latitude: 50.63, longitude: 3.06, kind: 'lead' });
    const contact = point({ id: 'c', latitude: 50.63, longitude: 3.06, kind: 'contact' });
    const bien = point({ id: 'b', latitude: 50.63, longitude: 3.06, kind: 'bien' });
    assert.deepEqual(pointDisplayCoord(lead), { latitude: 50.63, longitude: 3.06 });
    assert.notEqual(pointDisplayCoord(contact).latitude, lead.latitude);
    assert.notEqual(pointDisplayCoord(bien).longitude, lead.longitude);
  });
});

describe('clusterBuildings', () => {
  it('regroupe toutes les couches sous le zoom 16', () => {
    const a = {
      banId: 'a',
      latitude: 50.63,
      longitude: 3.06,
      postalCode: '59000',
      title: 'A',
      appearance: point({ id: 'a', latitude: 50.63, longitude: 3.06 }),
      count: 1,
      entities: [point({ id: 'a', latitude: 50.63, longitude: 3.06 })],
    };
    const b = {
      banId: 'b',
      latitude: 50.6302,
      longitude: 3.0602,
      postalCode: '59000',
      title: 'B',
      appearance: point({ id: 'b', latitude: 50.6302, longitude: 3.0602 }),
      count: 1,
      entities: [point({ id: 'b', latitude: 50.6302, longitude: 3.0602 })],
    };
    const items = clusterBuildings([a, b], 11);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.kind, 'cluster');
    if (items[0]?.kind === 'cluster') assert.equal(items[0].count, 2);
  });

  it('laisse chaque immeuble au zoom 16', () => {
    const a = {
      banId: 'a',
      latitude: 50.63,
      longitude: 3.06,
      postalCode: '59000',
      title: 'A',
      appearance: point({ id: 'a', latitude: 50.63, longitude: 3.06 }),
      count: 1,
      entities: [point({ id: 'a', latitude: 50.63, longitude: 3.06 })],
    };
    const b = {
      banId: 'b',
      latitude: 50.6302,
      longitude: 3.0602,
      postalCode: '59000',
      title: 'B',
      appearance: point({ id: 'b', latitude: 50.6302, longitude: 3.0602 }),
      count: 1,
      entities: [point({ id: 'b', latitude: 50.6302, longitude: 3.0602 })],
    };
    const items = clusterBuildings([a, b], 16);
    assert.equal(items.length, 2);
    assert.equal(items.every((item) => item.kind === 'building'), true);
  });
});
