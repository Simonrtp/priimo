import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BAN_MIN_SCORE,
  banCacheKey,
  createBanGeocodeCache,
  geocodeAdresse,
} from './ban';

describe('banCacheKey', () => {
  it('normalise la casse pour coller deux saisies identiques', () => {
    assert.equal(banCacheKey('12 Rue Test', '59000'), banCacheKey('12 rue test', '59000'));
  });
});

describe('geocodeAdresse', () => {
  it('prend le premier résultat au-dessus du seuil', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                id: '59122_0123_00012',
                label: '12 Rue de la Monnaie 59000 Lille',
                score: 0.91,
              },
              geometry: { coordinates: [3.063, 50.637] },
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    try {
      const hit = await geocodeAdresse('12 rue de la monnaie lille', '59000', createBanGeocodeCache());
      assert.ok(hit);
      assert.equal(hit?.ban_id, '59122_0123_00012');
      assert.equal(hit?.lat, 50.637);
      assert.equal(hit?.lng, 3.063);
      assert.equal(hit?.adresse_normalisee, '12 Rue de la Monnaie 59000 Lille');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('refuse un score sous le seuil plutôt que de coller au mauvais immeuble', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          features: [
            {
              properties: { id: 'x', label: 'Quelque part', score: BAN_MIN_SCORE - 0.01 },
              geometry: { coordinates: [2.3, 48.8] },
            },
          ],
        }),
        { status: 200 },
      )) as typeof fetch;

    try {
      const hit = await geocodeAdresse('adresse floue', undefined, createBanGeocodeCache());
      assert.equal(hit, null);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('ne rappelle pas la BAN pour la même adresse dans le cache de requête', async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          features: [
            {
              properties: { id: 'id-1', label: '12 Rue Test 59000 Lille', score: 0.8 },
              geometry: { coordinates: [3.06, 50.63] },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    try {
      const cache = createBanGeocodeCache();
      const a = await geocodeAdresse('12 rue test', '59000', cache);
      const b = await geocodeAdresse('12 Rue Test', '59000', cache);
      assert.equal(calls, 1);
      assert.equal(a?.ban_id, b?.ban_id);
    } finally {
      globalThis.fetch = original;
    }
  });
});
