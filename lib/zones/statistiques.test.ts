import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { statistiquesSecteur, type ImmeubleParc } from './statistiques';
import type { Zone } from './types';

/** Un carré autour de la rue de Bagnolet, à Paris 20e. */
const CARRE: [number, number][] = [
  [2.39, 48.84],
  [2.41, 48.84],
  [2.41, 48.86],
  [2.39, 48.86],
  [2.39, 48.84],
];

function zone(): Zone {
  return {
    id: 'z1',
    agencyId: 'a1',
    nom: 'Charonne',
    couleur: '#4C7A9E',
    assignedTo: 'moi',
    joursSemaine: [2],
    actif: true,
    verrouillee: false,
    regles: [
      {
        id: 'r1',
        zoneId: 'z1',
        inclusion: true,
        type: 'polygone',
        valeur: { type: 'Polygon', coordinates: [CARRE] },
      },
    ],
  };
}

function immeuble(
  banId: string,
  adresse: string,
  longitude: number,
  latitude: number,
): ImmeubleParc {
  return { banId, adresse, codePostal: '75020', longitude, latitude };
}

/** Trois immeubles dedans sur deux rues, un quatrième franchement dehors. */
function parc(): ImmeubleParc[] {
  return [
    immeuble('ban-1', '10 Rue de Bagnolet 75020 Paris', 2.4, 48.85),
    immeuble('ban-2', '12 Rue de Bagnolet 75020 Paris', 2.401, 48.851),
    immeuble('ban-3', '3 Avenue Gambetta 75020 Paris', 2.395, 48.845),
    immeuble('ban-4', '1 Rue de Rivoli 75001 Paris', 2.34, 48.86),
  ];
}

describe('statistiques d’un secteur', () => {
  it('compte les immeubles du parc qui tombent dans le contour', () => {
    const stats = statistiquesSecteur({
      zone: zone(),
      parc: parc(),
      passages: new Set(),
      leads: [],
    });
    assert.equal(stats.immeubles, 3);
    assert.equal(stats.rues, 2);
  });

  it('ne compte qu’une fois un immeuble à plusieurs entrées', () => {
    const doublon = [...parc(), immeuble('ban-1', '10 Rue de Bagnolet 75020 Paris', 2.4, 48.85)];
    const stats = statistiquesSecteur({
      zone: zone(),
      parc: doublon,
      passages: new Set(),
      leads: [],
    });
    assert.equal(stats.immeubles, 3);
  });

  it('rapproche deux écritures de la même rue', () => {
    const parcMele = [
      immeuble('ban-1', '10 Rue de Bagnolet 75020 Paris', 2.4, 48.85),
      immeuble('ban-2', '12 RUE DE BAGNOLET 75020 Paris', 2.401, 48.851),
    ];
    const stats = statistiquesSecteur({
      zone: zone(),
      parc: parcMele,
      passages: new Set(),
      leads: [],
    });
    assert.equal(stats.rues, 1);
    // Le libellé retenu est le lisible, pas celui qui crie.
    assert.equal(stats.principalesRues[0]?.nom, 'Rue de Bagnolet');
    assert.equal(stats.principalesRues[0]?.immeubles, 2);
  });

  it('mesure la couverture sur les immeubles vus, pas sur les leads', () => {
    const stats = statistiquesSecteur({
      zone: zone(),
      parc: parc(),
      // ban-4 est hors secteur : un passage ailleurs ne couvre rien ici.
      passages: new Set(['ban-1', 'ban-4']),
      leads: [],
    });
    assert.equal(stats.immeublesVus, 1);
    assert.equal(stats.couverture, 33);
  });

  it('ne prétend à aucune couverture quand le parc est muet', () => {
    const stats = statistiquesSecteur({
      zone: zone(),
      parc: [],
      passages: new Set(['ban-1']),
      leads: [],
    });
    assert.equal(stats.immeubles, 0);
    assert.equal(stats.couverture, null);
  });

  it('compte à part les adresses livrées par Priimo', () => {
    const stats = statistiquesSecteur({
      zone: zone(),
      parc: parc(),
      passages: new Set(),
      leads: [
        { address: '10 Rue de Bagnolet 75020 Paris', postalCode: '75020', longitude: 2.4, latitude: 48.85 },
        { address: '1 Rue de Rivoli 75001 Paris', postalCode: '75001', longitude: 2.34, latitude: 48.86 },
      ],
    });
    assert.equal(stats.adressesPriimo, 1);
  });

  it('classe les rues par nombre d’immeubles', () => {
    const stats = statistiquesSecteur({
      zone: zone(),
      parc: parc(),
      passages: new Set(),
      leads: [],
    });
    assert.deepEqual(
      stats.principalesRues.map((r) => r.nom),
      ['Rue de Bagnolet', 'Avenue Gambetta'],
    );
  });
});
