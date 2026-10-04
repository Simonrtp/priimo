import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatEtageForList, leadListAddressLine } from '../lead-display.js';
import { capVers, parseFacadeFormat, parseFacadeGeoParams, streetViewStaticUrl } from './street-view.js';

describe('formatEtageForList', () => {
  it('masque l’étage s’il n’est pas confirmé', () => {
    assert.equal(formatEtageForList(null, 'Appartement'), null);
    assert.equal(formatEtageForList('RDC', 'Appartement'), null);
    assert.equal(formatEtageForList('0', 'Appartement'), null);
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
      vue: 'street',
      tourner: null,
    });
  });

  it('lit la vue satellite', () => {
    const parsed = parseFacadeGeoParams(
      new URLSearchParams({ lat: '48.86', lng: '2.35', vue: 'satellite' }),
    );
    assert.equal(parsed?.vue, 'satellite');
  });

  it('refuse l’origine et les valeurs manquantes', () => {
    assert.equal(parseFacadeGeoParams(new URLSearchParams({ lat: '0', lng: '0' })), null);
    assert.equal(parseFacadeGeoParams(new URLSearchParams()), null);
    assert.equal(parseFacadeGeoParams(new URLSearchParams({ lat: 'abc', lng: '2' })), null);
  });
});

describe('regarder autour', () => {
  it('le cap vise l’immeuble depuis le point de prise de vue', () => {
    const depuis = { latitude: 48.8700, longitude: 2.3800 };
    assert.equal(capVers(depuis, { latitude: 48.8710, longitude: 2.3800 }), 0);
    assert.equal(capVers(depuis, { latitude: 48.8700, longitude: 2.3815 }), 90);
    assert.equal(capVers(depuis, { latitude: 48.8690, longitude: 2.3800 }), 180);
    assert.equal(capVers(depuis, { latitude: 48.8700, longitude: 2.3785 }), 270);
  });

  it('lit la rotation demandée, bornée à un demi-tour', () => {
    const lire = (q: string) => parseFacadeGeoParams(new URLSearchParams(`lat=48.87&lng=2.38&${q}`))?.tourner;
    assert.equal(lire(''), null);
    assert.equal(lire('tourner=60'), 60);
    assert.equal(lire('tourner=-120'), -120);
    assert.equal(lire('tourner=400'), null);
    assert.equal(lire('tourner=abc'), null);
  });

  it('une vue tournée garde le panorama et donne le cap', () => {
    const prev = process.env.GOOGLE_MAPS_API_KEY;
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    try {
      const url = streetViewStaticUrl(48.86, 2.35, 'detail', { pano: 'PANO123', heading: 75 });
      assert.match(url!, /pano=PANO123/);
      assert.match(url!, /heading=75/);
      assert.doesNotMatch(url!, /location=/);
    } finally {
      if (prev === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
      else process.env.GOOGLE_MAPS_API_KEY = prev;
    }
  });
});
