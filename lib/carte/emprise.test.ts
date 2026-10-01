import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cadastreDansEmprise, empriseDepuisZoneId } from './emprise';
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
});
