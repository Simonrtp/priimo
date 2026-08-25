import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compareBuildingPriority,
  countKindsInViewport,
  filterMapEntities,
  groupEntitiesByBanId,
  pickBuildingAppearance,
  type MapListFilters,
} from './buildings';
import type { MapPoint, MapPointKind } from './points';

function point(
  partial: Partial<MapPoint> & Pick<MapPoint, 'id' | 'kind' | 'banId'>,
): MapPoint {
  return {
    recordId: partial.id,
    latitude: 50.637,
    longitude: 3.063,
    postalCode: '59000',
    title: partial.id,
    subtitle: '',
    href: '/',
    color: '#E8743C',
    badge: '1',
    assignedTo: 'marie',
    occurredAt: '2026-08-01T10:00:00.000Z',
    ...partial,
  };
}

const ALL_KINDS = new Set<MapPointKind>(['lead', 'contact', 'bien', 'note']);

function filters(partial: Partial<MapListFilters> = {}): MapListFilters {
  return {
    kinds: ALL_KINDS,
    postalCode: 'tous',
    assignedTo: 'tous',
    period: 'all',
    now: Date.parse('2026-08-20T12:00:00.000Z'),
    ...partial,
  };
}

describe('groupEntitiesByBanId', () => {
  it('regroupe trois lots du même immeuble en un seul marqueur', () => {
    const buildings = groupEntitiesByBanId([
      point({ id: 'lot-a', kind: 'bien', banId: '59122_julie', title: 'Lot A' }),
      point({ id: 'lot-b', kind: 'bien', banId: '59122_julie', title: 'Lot B' }),
      point({ id: 'lot-c', kind: 'bien', banId: '59122_julie', title: 'Lot C' }),
    ]);
    assert.equal(buildings.length, 1);
    assert.equal(buildings[0]?.count, 3);
    assert.equal(buildings[0]?.appearance.kind, 'bien');
    assert.deepEqual(
      buildings[0]?.entities.map((e) => e.recordId).sort(),
      ['lot-a', 'lot-b', 'lot-c'],
    );
  });

  it('laisse deux immeubles distincts séparés', () => {
    const buildings = groupEntitiesByBanId([
      point({ id: 'a', kind: 'contact', banId: 'ban-1' }),
      point({ id: 'b', kind: 'contact', banId: 'ban-2', latitude: 50.69, longitude: 3.17 }),
    ]);
    assert.equal(buildings.length, 2);
  });
});

describe('pickBuildingAppearance', () => {
  it('prend le prospect plutôt que le bien, le contact ou la note', () => {
    const appearance = pickBuildingAppearance([
      point({ id: 'n', kind: 'note', banId: 'x' }),
      point({ id: 'c', kind: 'contact', banId: 'x' }),
      point({ id: 'b', kind: 'bien', banId: 'x' }),
      point({ id: 'p', kind: 'lead', banId: 'x', score: 62 }),
    ]);
    assert.equal(appearance.kind, 'lead');
    assert.equal(appearance.recordId, 'p');
  });

  it('prend le bien plutôt qu’un contact ou une note', () => {
    const appearance = pickBuildingAppearance([
      point({ id: 'n', kind: 'note', banId: 'x' }),
      point({ id: 'c', kind: 'contact', banId: 'x' }),
      point({ id: 'b', kind: 'bien', banId: 'x' }),
    ]);
    assert.equal(appearance.kind, 'bien');
  });

  it('affiche le prospect au score le plus élevé quand plusieurs cohabitent', () => {
    const appearance = pickBuildingAppearance([
      point({ id: 'low', kind: 'lead', banId: 'x', score: 62 }),
      point({ id: 'high', kind: 'lead', banId: 'x', score: 85 }),
    ]);
    assert.equal(appearance.recordId, 'high');
  });

  it('classe Prospect devant Bien devant Contact devant Note', () => {
    const ranked = [
      point({ id: 'n', kind: 'note', banId: 'x' }),
      point({ id: 'p', kind: 'lead', banId: 'x' }),
      point({ id: 'c', kind: 'contact', banId: 'x' }),
      point({ id: 'b', kind: 'bien', banId: 'x' }),
    ].sort(compareBuildingPriority);
    assert.deepEqual(
      ranked.map((p) => p.kind),
      ['lead', 'bien', 'contact', 'note'],
    );
  });
});

describe('filterMapEntities', () => {
  it('filtre par couche, code postal, assigné et période', () => {
    const points = [
      point({
        id: 'in',
        kind: 'lead',
        banId: 'a',
        postalCode: '59000',
        assignedTo: 'marie',
        occurredAt: '2026-08-10T00:00:00.000Z',
      }),
      point({
        id: 'cp',
        kind: 'lead',
        banId: 'b',
        postalCode: '59100',
        assignedTo: 'marie',
        occurredAt: '2026-08-10T00:00:00.000Z',
      }),
      point({
        id: 'old',
        kind: 'lead',
        banId: 'c',
        assignedTo: 'marie',
        occurredAt: '2025-01-01T00:00:00.000Z',
      }),
    ];
    const visible = filterMapEntities(
      points,
      filters({ kinds: new Set(['lead']), postalCode: '59000', assignedTo: 'marie', period: 30 }),
    );
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.recordId, 'in');
  });
});

describe('countKindsInViewport', () => {
  it('ne compte que ce qui est dans le cadre actuel', () => {
    const counts = countKindsInViewport(
      [
        point({ id: 'in', kind: 'lead', banId: 'a', latitude: 50.63, longitude: 3.06 }),
        point({ id: 'out', kind: 'lead', banId: 'b', latitude: 48.85, longitude: 2.35 }),
        point({ id: 'c', kind: 'contact', banId: 'a', latitude: 50.63, longitude: 3.06 }),
      ],
      { west: 3.0, south: 50.6, east: 3.1, north: 50.7 },
    );
    assert.equal(counts.lead, 1);
    assert.equal(counts.contact, 1);
    assert.equal(counts.bien, 0);
  });
});
