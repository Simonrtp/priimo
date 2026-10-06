import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { urlCarteMapbox } from './carte-mapbox';

describe('carte Mapbox statique', () => {
  it('renvoie null sans jeton, une URL avec jeton, jamais Street View', () => {
    const prev = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    assert.equal(urlCarteMapbox({ latitude: 43.43, longitude: -1.52 }), null);
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.test';
    const url = urlCarteMapbox({
      latitude: 43.43,
      longitude: -1.52,
      pins: [{ lat: 43.43, lng: -1.52, label: '1' }],
    });
    assert.ok(url);
    assert.match(url, /api\.mapbox\.com/);
    assert.doesNotMatch(url, /streetview/i);
    if (prev === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    else process.env.NEXT_PUBLIC_MAPBOX_TOKEN = prev;
  });
});
