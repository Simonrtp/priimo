import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatEtageForList, leadListAddressLine } from '../lead-display.js';
import { parseFacadeFormat, parseFacadeGeoParams, streetViewStaticUrl } from './street-view.js';

describe('formatEtageForList', () => {
  it('affiche « étage non confirmé » si absent ou RDC', () => {
    assert.equal(formatEtageForList(null, 'Appartement'), 'étage non confirmé');
    assert.equal(formatEtageForList('RDC', 'Appartement'), 'étage non confirmé');
    assert.equal(formatEtageForList('0', 'Appartement'), 'étage non confirmé');
  });

  it('formate les étages confirmés sans rez-de-chaussée', () => {
    assert.equal(formatEtageForList('1', 'Appartement'), '1er étage');
    assert.equal(formatEtageForList('3', 'Appartement'), '3e étage');
  });

  it('masque l’étage pour une maison', () => {
    assert.equal(formatEtageForList('2', 'Maison'), null);
  });
});

describe('leadListAddressLine', () => {
  it('concatène rue et code postal', () => {
    assert.equal(
      leadListAddressLine('13 Rue des Mûriers, 75020 Paris', '75020', 'Paris'),
      '13 Rue des Mûriers · 75020',
    );
  });
});

describe('streetViewStaticUrl', () => {
  it('construit l’URL avec les paramètres attendus', () => {
    const prev = process.env.GOOGLE_MAPS_API_KEY;
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    try {
      const url = streetViewStaticUrl(48.86, 2.35, 'liste');
      assert.ok(url);
      assert.match(url!, /maps\.googleapis\.com\/maps\/api\/streetview/);
      assert.match(url!, /location=48\.86%2C2\.35/);
      assert.match(url!, /size=240x160/);
      assert.match(url!, /fov=80/);
      assert.match(url!, /pitch=10/);
      assert.match(url!, /source=outdoor/);
      assert.match(url!, /return_error_code=true/);
    } finally {
      if (prev === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
      else process.env.GOOGLE_MAPS_API_KEY = prev;
    }
  });

  it('choisit le format detail', () => {
    assert.equal(parseFacadeFormat('detail'), 'detail');
    assert.equal(parseFacadeFormat('liste'), 'liste');
    assert.equal(parseFacadeFormat(null), 'liste');
  });
});

describe('parseFacadeGeoParams', () => {
  it('lit des coordonnées utilisables', () => {
    const parsed = parseFacadeGeoParams(
      new URLSearchParams({ lat: '48.86386', lng: '2.39775', format: 'detail' }),
    );
    assert.deepEqual(parsed, {
      latitude: 48.86386,
      longitude: 2.39775,
      format: 'detail',
    });
  });

  it('refuse l’origine et les valeurs manquantes', () => {
    assert.equal(parseFacadeGeoParams(new URLSearchParams({ lat: '0', lng: '0' })), null);
    assert.equal(parseFacadeGeoParams(new URLSearchParams()), null);
    assert.equal(parseFacadeGeoParams(new URLSearchParams({ lat: 'abc', lng: '2' })), null);
  });
});
