import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { keyframesVol, pointsVol, VOL_CHIP } from './vol-pipeline';

describe('vol-pipeline', () => {
  it('part de la gauche du lead et vise le centre de l’onglet', () => {
    const pts = pointsVol(
      { left: 40, top: 400, width: 600, height: 100 },
      { left: 900, top: 12, width: 80, height: 36 },
    );
    assert.equal(pts.start.x, 40 + 16);
    assert.equal(pts.start.y, 400 + 50 - VOL_CHIP.h / 2);
    assert.equal(pts.end.x, 900 + 40 - VOL_CHIP.w / 2);
    assert.equal(pts.end.y, 12 + 18 - VOL_CHIP.h / 2);
    assert.ok(pts.mid.y < Math.min(pts.start.y, pts.end.y));
    assert.ok(pts.mid.x > pts.start.x && pts.mid.x < pts.end.x);
  });

  it('n’anime que transform et opacity', () => {
    const frames = keyframesVol({
      start: { x: 10, y: 20 },
      mid: { x: 40, y: 0 },
      end: { x: 80, y: 8 },
    });
    assert.equal(frames.length, 3);
    for (const frame of frames) {
      assert.ok('transform' in frame);
      assert.ok('opacity' in frame);
      assert.ok(!('top' in frame) && !('left' in frame) && !('width' in frame));
    }
  });
});
