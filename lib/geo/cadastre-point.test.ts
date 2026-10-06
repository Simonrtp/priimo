import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lireParcelleAuPoint } from './cadastre-point';

describe('parcelle au point (API Carto)', () => {
  it('lit l’identifiant et la contenance', () => {
    assert.deepEqual(lireParcelleAuPoint({ idu: '75111000CB0047', contenance: 615 }), {
      parcelleId: '75111000CB0047',
      surfaceM2: 615,
    });
  });

  it('ignore une contenance absente ou nulle', () => {
    assert.deepEqual(lireParcelleAuPoint({ idu: '75111000CB0047', contenance: 0 }), {
      parcelleId: '75111000CB0047',
      surfaceM2: null,
    });
  });

  it('refuse un identifiant qui n’en est pas un', () => {
    assert.equal(lireParcelleAuPoint({ idu: 'CB47' }), null);
    assert.equal(lireParcelleAuPoint(undefined), null);
  });
});
