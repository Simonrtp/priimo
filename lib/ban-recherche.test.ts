import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BanFeature } from '@/lib/ban';
import {
  numeroDansTexte,
  prioriserNumeroExact,
  rueSeule,
  versAdressesTrouvees,
} from './ban-recherche';

function feat(label: string, id: string): BanFeature {
  return {
    properties: {
      label,
      score: 0.9,
      city: 'Paris',
      postcode: '75020',
      context: '',
      id,
    },
    geometry: { coordinates: [2.38, 48.86] },
  };
}

describe('numeroDansTexte', () => {
  it('lit le numéro en tête', () => {
    assert.equal(numeroDansTexte('27 rue Alphonse Penaud'), '27');
    assert.equal(numeroDansTexte('27B avenue de la République'), '27b');
  });

  it('ignore une saisie sans numéro', () => {
    assert.equal(numeroDansTexte('rue Alphonse Penaud'), null);
  });
});

describe('prioriserNumeroExact', () => {
  it('remonte le housenumber tapé devant les voisins', () => {
    const ranked = prioriserNumeroExact(
      [
        feat('29 Rue Alphonse Penaud 75020 Paris', '29'),
        feat('27 Rue Alphonse Penaud 75020 Paris', '27'),
        feat('31 Rue Alphonse Penaud 75020 Paris', '31'),
      ],
      '27 rue alphonse penaud',
    );
    assert.equal(ranked[0]?.properties.id, '27');
    assert.equal(ranked[1]?.properties.id, '29');
  });

  it('ne réordonne pas sans numéro dans la requête', () => {
    const input = [
      feat('29 Rue Alphonse Penaud 75020 Paris', '29'),
      feat('27 Rue Alphonse Penaud 75020 Paris', '27'),
    ];
    const ranked = prioriserNumeroExact(input, 'rue alphonse penaud');
    assert.equal(ranked[0]?.properties.id, '29');
  });
});

describe('versAdressesTrouvees', () => {
  it('applique la priorisation et retire la ville du label', () => {
    const adresses = versAdressesTrouvees(
      [
        feat('29 Rue Alphonse Penaud 75020 Paris', '29'),
        feat('27 Rue Alphonse Penaud 75020 Paris', '27'),
      ],
      '27 rue alphonse penaud',
    );
    assert.equal(adresses[0]?.banId, '27');
    assert.equal(adresses[0]?.label, rueSeule('27 Rue Alphonse Penaud 75020 Paris', '75020', 'Paris'));
  });
});
