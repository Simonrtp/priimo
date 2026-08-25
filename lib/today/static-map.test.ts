import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LocatedTask } from './tournee';

const STOPS: LocatedTask[] = [
  { key: 'a', address: '12 rue A', latitude: 48.86, longitude: 2.34 },
  { key: 'b', address: '14 rue B', latitude: 48.862, longitude: 2.342 },
];

describe('staticTourneeUrl', () => {
  it('encode le tracé orange avec des point-virgules entre les arrêts', async () => {
    const prev = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.test-token';
    try {
      const { staticTourneeUrl } = await import('./static-map.js');
      const url = staticTourneeUrl(STOPS);
      assert.ok(url);
      assert.match(url!, /path-5%2BE8743C-0\.95\(2\.34%2C48\.86%3B2\.342%2C48\.862\)/);
      assert.match(url!, /pin-s-1%2BE8743C/);
      assert.match(url!, /pin-s-2%2BE8743C/);
      assert.match(url!, /,58(\.0)?\/680x200/);
      assert.match(url!, /\/[\d.-]+,[\d.-]+,1[6-7]/);
      assert.doesNotMatch(url!, /\[2\.3/);
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      else process.env.NEXT_PUBLIC_MAPBOX_TOKEN = prev;
    }
  });

  it('retourne null sans jeton', async () => {
    const prev = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    try {
      const { staticTourneeUrl } = await import('./static-map.js');
      assert.equal(staticTourneeUrl(STOPS), null);
    } finally {
      if (prev !== undefined) process.env.NEXT_PUBLIC_MAPBOX_TOKEN = prev;
    }
  });
});
