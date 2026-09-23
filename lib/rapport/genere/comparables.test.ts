import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ecarterComparablesAberrants,
  mutationsMonoLogement,
  selectionnerComparables,
  type MutationBrute,
} from './comparables';

function tx(over: Partial<MutationBrute> & Pick<MutationBrute, 'id'>): MutationBrute {
  return {
    idMutation: over.id,
    dateMutation: '2026-03-01',
    valeurFonciere: 250000,
    surfaceM2: 50,
    pieces: 2,
    typeLocal: 'Appartement',
    codePostal: '75011',
    banId: over.id,
    parcelleId: null,
    latitude: 48.86,
    longitude: 2.38,
    ...over,
  };
}

describe('ventes comparables', () => {
  it('écarte une mutation de plusieurs logements', () => {
    const rows = [
      tx({ id: 'a', idMutation: 'M1', typeLocal: 'Appartement' }),
      tx({ id: 'b', idMutation: 'M1', typeLocal: 'Appartement', surfaceM2: 40 }),
      tx({ id: 'c', idMutation: 'M2', typeLocal: 'Appartement' }),
    ];
    const mono = mutationsMonoLogement(rows);
    assert.equal(mono.length, 1);
    assert.equal(mono[0]?.id, 'M2');
  });

  it('tolère une dépendance sur la même mutation', () => {
    const rows = [
      tx({ id: 'a', idMutation: 'M1', typeLocal: 'Appartement' }),
      tx({ id: 'b', idMutation: 'M1', typeLocal: 'Dépendance', surfaceM2: 8, valeurFonciere: 0 }),
    ];
    assert.equal(mutationsMonoLogement(rows).length, 1);
  });

  it('ne retient que le rayon puis élargit à la commune', () => {
    const maintenant = new Date('2026-06-01');
    const proche = tx({ id: 'p', latitude: 48.8601, longitude: 2.3801 });
    const loin = tx({
      id: 'l',
      latitude: 48.9,
      longitude: 2.4,
      dateMutation: '2026-01-01',
    });
    const { retenues } = selectionnerComparables([proche, loin], {
      propertyType: 'appartement',
      surfaceM2: 50,
      codePostal: '75011',
      latitude: 48.86,
      longitude: 2.38,
      exclus: [],
      maintenant,
    });
    assert.ok(retenues.some((v) => v.id === 'p'));
  });

  it('écarte une vente à 4 833 €/m² trop loin de la médiane', () => {
    const proches = [7000, 7100, 7176, 7200, 7300, 7400].map((pm2, i) => ({
      id: `n${i}`,
      prixM2: pm2,
    }));
    const { retenues, exclues } = ecarterComparablesAberrants([
      ...proches,
      { id: 'bas', prixM2: 4833 },
    ]);
    assert.equal(retenues.some((v) => v.id === 'bas'), false);
    assert.equal(exclues.some((v) => v.id === 'bas'), true);
  });

  it('honore les exclusions de l’agent', () => {
    const { retenues, reserve } = selectionnerComparables(
      [tx({ id: 'p', latitude: 48.8601, longitude: 2.3801 })],
      {
        propertyType: 'appartement',
        surfaceM2: 50,
        codePostal: '75011',
        latitude: 48.86,
        longitude: 2.38,
        exclus: ['p'],
        maintenant: new Date('2026-06-01'),
      },
    );
    assert.equal(retenues.length, 0);
    assert.equal(reserve.length, 1);
  });
});
