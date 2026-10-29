import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CadastreImmeublePoint, ParcelleNoteMarker } from './parcelle';
import type { ParcelleFiche } from './parcelle';
import { avecDpeClique, mergeOverlayPayload, quantizeViewport } from './use-parcelle-map';

describe('quantizeViewport', () => {
  it('élargit toujours l’emprise au lieu d’en couper les bords', () => {
    const source = {
      west: 2.3471,
      south: 48.8511,
      east: 2.3511,
      north: 48.8551,
      zoom: 16.4,
    };
    const result = quantizeViewport(source);
    assert.ok(result.west <= source.west);
    assert.ok(result.south <= source.south);
    assert.ok(result.east >= source.east);
    assert.ok(result.north >= source.north);
  });

  it('ne réduit pas à zéro une petite emprise fortement zoomée', () => {
    const result = quantizeViewport({
      west: 2.3491,
      south: 48.8531,
      east: 2.3497,
      north: 48.8537,
      zoom: 18,
    });
    assert.ok(result.east > result.west);
    assert.ok(result.north > result.south);
  });
});

describe('mergeOverlayPayload', () => {
  it('conserve les DPE déjà chargés quand une nouvelle emprise arrive', () => {
    const dpeA = { banId: 'a', parcelleId: 'p-a' } as CadastreImmeublePoint;
    const dpeB = { banId: 'b', parcelleId: 'p-b' } as CadastreImmeublePoint;
    const noteA = { parcelleId: 'p-a' } as ParcelleNoteMarker;
    const sources = { diagnosticsAt: null, ventesAt: null };
    const result = mergeOverlayPayload(
      { immeubles: [dpeA], notes: [noteA], sources, proprioUniqueParcelleIds: ['p-a'] },
      { immeubles: [dpeB], notes: [], sources, proprioUniqueParcelleIds: ['p-b'] },
    );
    assert.deepEqual(
      result.immeubles.map((row) => row.banId).sort(),
      ['a', 'b'],
    );
    assert.equal(result.notes[0]?.parcelleId, 'p-a');
    assert.deepEqual(result.proprioUniqueParcelleIds.sort(), ['p-a', 'p-b']);
  });
});

describe('avecDpeClique', () => {
  it('place le DPE frais du marqueur avant la copie locale plus ancienne', () => {
    const fiche = {
      logements: [
        {
          banId: 'ban-1',
          date: '2026-03-10',
          etiquette: 'C',
          etiquetteGes: null,
          consoKwhM2: null,
          surface: 55,
          etage: 2,
        },
      ],
    } as ParcelleFiche;
    const result = avecDpeClique(fiche, {
      banId: 'ban-1',
      date: '2026-09-20',
      etiquette: 'C',
      etiquetteGes: null,
      consoKwhM2: null,
      surface: 55,
      etage: 2,
    });
    assert.deepEqual(
      result.logements.map((row) => row.date),
      ['2026-09-20', '2026-03-10'],
    );
  });
});
