import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cotesDeLaVoie, numerosDeLaRegle, resumerVoie } from './voie-trace';

const n = (numero: number, x: number, suffixe: string | null = null) => ({
  numero,
  suffixe,
  longitude: x,
  latitude: 48.86,
});

const RUE = [n(1, 1), n(2, 2), n(3, 3), n(4, 4), n(5, 5), n(6, 6), n(40, 40), n(41, 41)];

describe('ce qu’une règle de voie retient', () => {
  it('garde un seul côté', () => {
    assert.deepEqual(
      numerosDeLaRegle(RUE, { parite: 'paires', numero_min: null, numero_max: null }).map((x) => x.numero),
      [2, 4, 6, 40],
    );
    assert.deepEqual(
      numerosDeLaRegle(RUE, { parite: 'impaires', numero_min: null, numero_max: null }).map((x) => x.numero),
      [1, 3, 5, 41],
    );
  });

  it('borne la plage de numéros, bornes comprises', () => {
    assert.deepEqual(
      numerosDeLaRegle(RUE, { parite: 'toutes', numero_min: 3, numero_max: 6 }).map((x) => x.numero),
      [3, 4, 5, 6],
    );
  });

  it('trace un trait par côté, dans l’ordre des numéros', () => {
    const cotes = cotesDeLaVoie([n(4, 4), n(2, 2), n(3, 3), n(1, 1), n(2, 2.5, 'bis')]);
    assert.deepEqual(
      cotes.map((c) => c.map((p) => p[0])),
      [
        [2, 2.5, 4],
        [1, 3],
      ],
    );
  });

  it('ne trace pas un côté d’un seul numéro', () => {
    assert.equal(cotesDeLaVoie([n(1, 1), n(2, 2), n(4, 4)]).length, 1);
  });

  it('résume la règle en une ligne', () => {
    assert.equal(
      resumerVoie({ nom_voie: 'Rue Oberkampf', parite: 'paires', numero_min: 2, numero_max: 40 }),
      'Rue Oberkampf · pairs · 2 à 40',
    );
    assert.equal(
      resumerVoie({ nom_voie: 'Rue Oberkampf', parite: 'toutes', numero_min: null, numero_max: 12 }),
      'Rue Oberkampf · jusqu’au 12',
    );
  });
});
