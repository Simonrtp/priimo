import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ZONE_TOUS_SECTEURS,
  aUnSecteurDefini,
  cadastreDansEmprise,
  cadastreDansEmprises,
  empriseDepuisZoneId,
  secteursDeLaCarte,
  zoneParDefautProspection,
} from './emprise';
import type { Zone } from '@/lib/zones/types';

const zone: Zone = {
  id: 'ouest',
  agencyId: 'a1',
  nom: 'Ouest',
  couleur: '#4C7A9E',
  assignedTo: 'moi',
  joursSemaine: [],
  actif: true,
  verrouillee: false,
  regles: [
    {
      id: 'r1',
      zoneId: 'ouest',
      inclusion: true,
      type: 'polygone',
      valeur: {
        type: 'Polygon',
        coordinates: [
          [
            [2.38, 48.84],
            [2.4, 48.84],
            [2.4, 48.86],
            [2.38, 48.86],
            [2.38, 48.84],
          ],
        ],
      },
    },
  ],
};

describe('empriseDepuisZoneId', () => {
  it('traite aucun et tous comme le code postal', () => {
    assert.equal(empriseDepuisZoneId('aucun'), 'code_postal');
    assert.equal(empriseDepuisZoneId('tous'), 'code_postal');
  });

  it('traite un identifiant de zone comme le secteur', () => {
    assert.equal(empriseDepuisZoneId('ouest'), 'secteur');
    assert.equal(empriseDepuisZoneId(ZONE_TOUS_SECTEURS), 'secteur');
  });
});

describe('aUnSecteurDefini', () => {
  it('ignore un secteur qui n’a encore aucune rue', () => {
    assert.equal(aUnSecteurDefini([]), false);
    assert.equal(aUnSecteurDefini([{ ...zone, regles: [] }]), false);
    assert.equal(aUnSecteurDefini([{ ...zone, actif: false }]), false);
    assert.equal(aUnSecteurDefini([zone]), true);
  });
});

describe('secteursDeLaCarte', () => {
  const mien = { ...zone, id: 'mien', nom: 'Secteur de Simon', assignedTo: 'moi' };
  const sien = { ...zone, id: 'sien', nom: 'Secteur de Camille', assignedTo: 'camille' };

  it('ne propose au négociateur que son secteur', () => {
    assert.deepEqual(
      secteursDeLaCarte([sien, mien], 'moi', false).map((z) => z.id),
      ['mien'],
    );
  });

  it('propose au directeur tous les secteurs, le sien d’abord', () => {
    assert.deepEqual(
      secteursDeLaCarte([sien, mien], 'moi', true).map((z) => z.id),
      ['mien', 'sien'],
    );
  });

  it('ouvre tous les secteurs pour le directeur', () => {
    assert.equal(zoneParDefautProspection([sien, mien], 'moi', true), ZONE_TOUS_SECTEURS);
    assert.equal(zoneParDefautProspection([sien], 'moi', true), 'sien');
    assert.equal(zoneParDefautProspection([], 'moi', true), null);
  });

  it('ouvre tous les secteurs de l’agent qui en a plusieurs, sauf celui prévu aujourd’hui', () => {
    const second = { ...zone, id: 'second', nom: 'Secteur de Simon 2', assignedTo: 'moi' };
    assert.equal(zoneParDefautProspection([sien, mien, second], 'moi', false), ZONE_TOUS_SECTEURS);
    assert.equal(zoneParDefautProspection([sien, mien], 'moi', false), 'mien');
    const chaqueJour = { ...second, joursSemaine: [0, 1, 2, 3, 4, 5, 6, 7] };
    assert.equal(zoneParDefautProspection([mien, chaqueJour], 'moi', false), 'second');
  });
});

describe('cadastreDansEmprise', () => {
  it('laisse tout passer sans zone', () => {
    assert.equal(cadastreDansEmprise({ latitude: 48.85, longitude: 2.5 }, null), true);
  });

  it('garde un point dans le secteur et retire le reste', () => {
    assert.equal(cadastreDansEmprise({ latitude: 48.85, longitude: 2.39 }, zone), true);
    assert.equal(cadastreDansEmprise({ latitude: 48.85, longitude: 2.5 }, zone), false);
  });

  it('garde un point dès qu’un des secteurs le contient', () => {
    const autre: Zone = {
      ...zone,
      id: 'est',
      regles: [
        {
          id: 'r2',
          zoneId: 'est',
          inclusion: true,
          type: 'polygone',
          valeur: {
            type: 'Polygon',
            coordinates: [
              [
                [2.45, 48.84],
                [2.55, 48.84],
                [2.55, 48.86],
                [2.45, 48.86],
                [2.45, 48.84],
              ],
            ],
          },
        },
      ],
    };
    assert.equal(cadastreDansEmprises({ latitude: 48.85, longitude: 2.5 }, [zone, autre]), true);
    assert.equal(cadastreDansEmprises({ latitude: 48.85, longitude: 2.2 }, [zone, autre]), false);
    assert.equal(cadastreDansEmprises({ latitude: 48.85, longitude: 2.2 }, null), true);
  });
});
