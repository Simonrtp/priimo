import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAP_3D_PITCH } from './camera';
import { cameraFor, parseMapDimension, toggleDimension } from './view-mode';

describe('parseMapDimension', () => {
  it('retombe sur 2D pour toute valeur inconnue', () => {
    assert.equal(parseMapDimension('3d'), '3d');
    assert.equal(parseMapDimension('2d'), '2d');
    assert.equal(parseMapDimension(null), '2d');
    assert.equal(parseMapDimension('relief'), '2d');
  });
});

describe('toggleDimension', () => {
  it('bascule entre les deux vues', () => {
    assert.equal(toggleDimension('2d'), '3d');
    assert.equal(toggleDimension('3d'), '2d');
  });
});

describe('cameraFor', () => {
  it('met le plan à plat en 2D', () => {
    assert.deepEqual(cameraFor('2d'), { pitch: 0, bearing: 0 });
  });

  it('incline la caméra en 3D pour voir le relief', () => {
    assert.equal(cameraFor('3d').pitch, MAP_3D_PITCH);
  });
});
