import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { projectOnLine, stopPixelOffsets } from './itineraire-trace.js';
import type { LngLat } from './simplify-line.js';

describe('projectOnLine', () => {
  it('place un point au milieu d’un segment', () => {
    const coords: LngLat[] = [
      [2.34, 48.86],
      [2.342, 48.86],
    ];
    const hit = projectOnLine(coords, { latitude: 48.86, longitude: 2.341 });
    assert.ok(hit);
    assert.ok(Math.abs(hit!.fraction - 0.5) < 0.08);
  });
});

describe('stopPixelOffsets', () => {
  it('écarte deux arrêts au même endroit', () => {
    const a = { latitude: 48.86, longitude: 2.34 };
    const offsets = stopPixelOffsets([a, { ...a }], 16, 24);
    const dist = Math.hypot(offsets[0]![0] - offsets[1]![0], offsets[0]![1] - offsets[1]![1]);
    assert.ok(dist >= 23);
  });

  it('laisse deux arrêts éloignés en place', () => {
    const offsets = stopPixelOffsets(
      [
        { latitude: 48.86, longitude: 2.34 },
        { latitude: 48.862, longitude: 2.343 },
      ],
      15,
      24,
    );
    assert.deepEqual(offsets, [
      [0, 0],
      [0, 0],
    ]);
  });
});
