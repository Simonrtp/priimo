import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lumiereDuSoleil, positionSoleil, resoudreLumiere } from './lumiere';

const PARIS = { lat: 48.8566, lng: 2.3522 };

describe('lumière du soleil (Paris)', () => {
  it('midi solaire d’été : soleil haut, plein jour', () => {
    const { hauteur } = positionSoleil(new Date('2026-06-21T11:50:00Z'), PARIS.lat, PARIS.lng);
    assert.ok(hauteur > 63 && hauteur < 66, `hauteur ${hauteur}`);
    assert.equal(lumiereDuSoleil(new Date('2026-06-21T11:50:00Z'), PARIS.lat, PARIS.lng), 'day');
  });

  it('le 20 octobre : aube vers 8 h, crépuscule vers 19 h, nuit à 21 h (heure de Paris)', () => {
    // Lever du soleil à Paris le 20/10/2026 ≈ 8 h 22, coucher ≈ 18 h 47 (UTC+2).
    assert.equal(lumiereDuSoleil(new Date('2026-10-20T06:15:00Z'), PARIS.lat, PARIS.lng), 'dawn');
    assert.equal(lumiereDuSoleil(new Date('2026-10-20T12:00:00Z'), PARIS.lat, PARIS.lng), 'day');
    assert.equal(lumiereDuSoleil(new Date('2026-10-20T17:00:00Z'), PARIS.lat, PARIS.lng), 'dusk');
    assert.equal(lumiereDuSoleil(new Date('2026-10-20T19:00:00Z'), PARIS.lat, PARIS.lng), 'night');
    assert.equal(lumiereDuSoleil(new Date('2026-10-20T02:00:00Z'), PARIS.lat, PARIS.lng), 'night');
  });

  it('un choix forcé l’emporte sur le soleil', () => {
    assert.equal(resoudreLumiere('night', new Date('2026-06-21T11:50:00Z'), PARIS.lat, PARIS.lng), 'night');
    assert.equal(resoudreLumiere('auto', new Date('2026-06-21T11:50:00Z'), PARIS.lat, PARIS.lng), 'day');
  });
});
