import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { simplifyLine, simplifyToleranceM, type LngLat } from './simplify-line.js';

describe('simplifyToleranceM', () => {
  it('reste sous la largeur d’une rue', () => {
    assert.ok(simplifyToleranceM(13) <= 4);
    assert.ok(simplifyToleranceM(15) <= 3);
    assert.ok(simplifyToleranceM(18) >= 1);
    assert.ok(simplifyToleranceM(18) < 8);
  });
});

describe('simplifyLine', () => {
  it('ôte les micro-sommets d’une ligne presque droite', () => {
    const line: LngLat[] = [
      [2.34, 48.86],
      [2.34001, 48.86001],
      [2.34002, 48.860005],
      [2.341, 48.861],
    ];
    const out = simplifyLine(line, 2.5);
    assert.ok(out.length < line.length);
    assert.deepEqual(out[0], line[0]);
    assert.deepEqual(out[out.length - 1], line[line.length - 1]);
  });

  it('garde un vrai virage', () => {
    const line: LngLat[] = [
      [2.34, 48.86],
      [2.341, 48.86],
      [2.341, 48.861],
    ];
    const out = simplifyLine(line, 2);
    assert.equal(out.length, 3);
  });
});
