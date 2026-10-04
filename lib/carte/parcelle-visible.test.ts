import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assurerPointVisible } from './parcelle-visible';

function stubDesktop(matches: boolean) {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = ((q: string) =>
    ({
      matches: matches && String(q).includes('min-width: 768px'),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof matchMedia;
  return () => {
    globalThis.matchMedia = original;
  };
}

describe('assurerPointVisible', () => {
  it('décale la carte quand le point est sous le volet (droite)', () => {
    let eased: { center: [number, number] } | null = null;
    const map = {
      getCanvas: () => ({ clientWidth: 1000, clientHeight: 700 }) as HTMLCanvasElement,
      project: ([lng, lat]: [number, number]) => {
        if (lng === 2.4 && lat === 48.8) return { x: 500, y: 350 };
        return { x: 900, y: 350 };
      },
      unproject: ([x, y]: [number, number]) => ({
        lng: 2.4 + (x - 500) / 100,
        lat: 48.8 + (y - 350) / 100,
      }),
      getCenter: () => ({ lng: 2.4, lat: 48.8 }),
      easeTo: (opts: { center: [number, number] }) => {
        eased = opts;
      },
    };
    const restore = stubDesktop(true);
    try {
      assurerPointVisible(map, { longitude: 2.9, latitude: 48.8 });
      assert.ok(eased);
      assert.ok(eased!.center[0] > 2.4);
    } finally {
      restore();
    }
  });

  it('ne bouge pas si le point est déjà dans la zone libre', () => {
    let eased = false;
    const map = {
      getCanvas: () => ({ clientWidth: 1000, clientHeight: 700 }) as HTMLCanvasElement,
      project: () => ({ x: 200, y: 300 }),
      unproject: () => ({ lng: 2.4, lat: 48.8 }),
      getCenter: () => ({ lng: 2.4, lat: 48.8 }),
      easeTo: () => {
        eased = true;
      },
    };
    const restore = stubDesktop(true);
    try {
      assurerPointVisible(map, { longitude: 2.35, latitude: 48.8 });
      assert.equal(eased, false);
    } finally {
      restore();
    }
  });
});
