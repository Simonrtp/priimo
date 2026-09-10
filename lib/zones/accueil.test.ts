import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apercuSecteur } from './accueil';
import type { LeadSituable } from './leads';
import type { RegleZone, ValeurPolygone, Zone } from './types';

const MOI = 'moi';
const COLLEGUE = 'thomas';
// Mardi 8 septembre 2026.
const MARDI = new Date('2026-09-08T07:00:00Z');

function carre(lngMin: number, lngMax: number): ValeurPolygone {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lngMin, 48.84],
        [lngMax, 48.84],
        [lngMax, 48.86],
        [lngMin, 48.86],
        [lngMin, 48.84],
      ],
    ],
  };
}

function zone(id: string, assignedTo: string | null, lngMin: number, lngMax: number, jour: number | null = null): Zone {
  const regle: RegleZone = {
    id: `r-${id}`,
    zoneId: id,
    inclusion: true,
    type: 'polygone',
    valeur: carre(lngMin, lngMax),
  };
  return {
    id,
    agencyId: 'a1',
    nom: `Zone ${id}`,
    couleur: '#4C7A9E',
    assignedTo,
    jourSemaine: jour,
    actif: true,
    regles: [regle],
  };
}

function lead(id: string, longitude: number, stageId: string | null = null): LeadSituable {
  return {
    id,
    address: '10 Rue de Test 75020 Paris',
    postalCode: '75020',
    latitude: 48.85,
    longitude,
    assignedTo: null,
    stageId,
    deliveredAt: '2026-09-07',
    createdAt: '2026-09-07T08:00:00Z',
  };
}

describe('aperçu du secteur — négociateur', () => {
  const zones = [zone('ouest', MOI, 2.38, 2.4), zone('est', COLLEGUE, 2.4, 2.42)];

  it('ne montre que son secteur', () => {
    const a = apercuSecteur({ leads: [], zones, profileId: MOI, estDirecteur: false });
    assert.deepEqual(
      a.zones.map((z) => z.id),
      ['ouest'],
    );
  });

  it('compte ce qui reste à travailler et ce qui est déjà pris', () => {
    const a = apercuSecteur({
      leads: [lead('a', 2.39), lead('b', 2.39, 'entree'), lead('c', 2.41)],
      zones,
      profileId: MOI,
      estDirecteur: false,
    });
    assert.equal(a.aTravailler, 1);
    assert.equal(a.dejaPrises, 1);
  });

  it('ne pose sur la carte que les adresses non prises', () => {
    const a = apercuSecteur({
      leads: [lead('a', 2.39), lead('b', 2.39, 'entree')],
      zones,
      profileId: MOI,
      estDirecteur: false,
    });
    assert.deepEqual(
      a.points.map((p) => p.id),
      ['a'],
    );
  });

  it('met le secteur du jour en tête', () => {
    const avecJours = [
      zone('lundi', MOI, 2.3, 2.32, 1),
      zone('mardi', MOI, 2.32, 2.34, 2),
    ];
    const a = apercuSecteur({
      leads: [],
      zones: avecJours,
      profileId: MOI,
      estDirecteur: false,
      maintenant: MARDI,
    });
    assert.deepEqual(
      a.zones.map((z) => z.id),
      ['mardi', 'lundi'],
    );
  });

  it('ne rend rien quand l’agent n’a pas de secteur', () => {
    const a = apercuSecteur({
      leads: [lead('a', 2.41)],
      zones: [zone('est', COLLEGUE, 2.4, 2.42)],
      profileId: MOI,
      estDirecteur: false,
    });
    assert.deepEqual(a.zones, []);
    assert.deepEqual(a.points, []);
    assert.equal(a.aTravailler, 0);
  });

  it('ignore un lead non géocodé', () => {
    const sansCoords = { ...lead('a', 2.39), latitude: null, longitude: null };
    const a = apercuSecteur({ leads: [sansCoords], zones, profileId: MOI, estDirecteur: false });
    assert.deepEqual(a.points, []);
  });
});

describe('aperçu du secteur — directeur', () => {
  const zones = [zone('ouest', MOI, 2.38, 2.4), zone('est', COLLEGUE, 2.4, 2.42)];

  it('montre tout le découpage de l’agence', () => {
    const a = apercuSecteur({
      leads: [lead('a', 2.39), lead('c', 2.41)],
      zones,
      profileId: 'directeur',
      estDirecteur: true,
    });
    assert.deepEqual(
      a.zones.map((z) => z.id),
      ['ouest', 'est'],
    );
    assert.equal(a.aTravailler, 2);
  });

  it('laisse dehors les adresses qu’aucune zone ne couvre', () => {
    const a = apercuSecteur({
      leads: [lead('loin', 2.6)],
      zones,
      profileId: 'directeur',
      estDirecteur: true,
    });
    assert.equal(a.aTravailler, 0);
    assert.deepEqual(a.points, []);
  });

  it('ignore les zones désactivées', () => {
    const eteinte: Zone = { ...zones[1]!, actif: false };
    const a = apercuSecteur({
      leads: [lead('c', 2.41)],
      zones: [zones[0]!, eteinte],
      profileId: 'directeur',
      estDirecteur: true,
    });
    assert.deepEqual(
      a.zones.map((z) => z.id),
      ['ouest'],
    );
    assert.equal(a.aTravailler, 0);
  });
});
