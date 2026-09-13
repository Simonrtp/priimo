import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apercuSecteur } from './accueil';
import type { LeadSituable } from './leads';
import type { RegleZone, ValeurPolygone, Zone } from './types';

const MOI = 'moi';
const COLLEGUE = 'thomas';
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
    joursSemaine: jour === null ? [] : [jour],
    actif: true,
    verrouillee: false,
    regles: [regle],
  };
}

function lead(id: string, longitude: number, extra: Partial<LeadSituable> = {}): LeadSituable {
  return {
    id,
    address: '10 Rue de Test 75020 Paris',
    postalCode: '75020',
    latitude: 48.85,
    longitude,
    assignedTo: null,
    stageId: null,
    deliveredAt: '2026-09-07',
    createdAt: '2026-09-07T08:00:00Z',
    banId: `ban-${id}`,
    ...extra,
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

  it('classe les adresses selon le dernier passage observé', () => {
    const a = apercuSecteur({
      leads: [lead('a', 2.39), lead('b', 2.39), lead('c', 2.41)],
      zones,
      profileId: MOI,
      estDirecteur: false,
      maintenant: MARDI,
      passages: [
        { banId: 'ban-a', profileId: MOI, jour: '2026-09-07' },
        { banId: 'ban-b', profileId: MOI, jour: '2026-01-01' },
      ],
    });
    assert.equal(a.repartition.semaine, 1);
    assert.equal(a.repartition.revoir, 1);
    assert.equal(a.repartition.jamais, 0);
    assert.equal(a.points.length, 2);
    assert.equal(a.points.find((p) => p.id === 'a')?.niveau, 'semaine');
    assert.equal(a.points.find((p) => p.id === 'b')?.niveau, 'revoir');
    assert.equal(a.points.find((p) => p.id === 'a')?.zoneId, 'ouest');
  });

  it('met le secteur du jour en tête', () => {
    const avecJours = [zone('lundi', MOI, 2.3, 2.32, 1), zone('mardi', MOI, 2.32, 2.34, 2)];
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
    assert.equal(a.aRevoir, 0);
  });

  it('n’écrit pas le seuil tant que le cycle n’est pas observé', () => {
    const a = apercuSecteur({
      leads: [lead('a', 2.39)],
      zones,
      profileId: MOI,
      estDirecteur: false,
      maintenant: MARDI,
    });
    assert.equal(a.cycleSemaines, null);
    assert.match(a.phrase ?? '', /trop longtemps/);
    assert.doesNotMatch(a.phrase ?? '', /12/);
  });

  it('ignore un lead non géocodé pour le point, pas pour le compte', () => {
    const sansCoords = { ...lead('a', 2.39), latitude: null, longitude: null };
    const parCp: Zone = {
      ...zones[0]!,
      regles: [
        {
          id: 'r-cp',
          zoneId: 'ouest',
          inclusion: true,
          type: 'code_postal',
          valeur: { code_postal: '75020' },
        },
      ],
    };
    const a = apercuSecteur({
      leads: [sansCoords],
      zones: [parCp, zones[1]!],
      profileId: MOI,
      estDirecteur: false,
    });
    assert.deepEqual(a.points, []);
    assert.equal(a.repartition.jamais, 1);
  });
});

describe('aperçu du secteur — directeur', () => {
  const zones = [zone('ouest', MOI, 2.38, 2.4), zone('est', COLLEGUE, 2.4, 2.42)];

  it('montre tout le découpage et le nombre à revoir par zone', () => {
    const a = apercuSecteur({
      leads: [lead('a', 2.39), lead('c', 2.41)],
      zones,
      profileId: 'directeur',
      estDirecteur: true,
      titulaires: { [MOI]: 'Simon Ropiot', [COLLEGUE]: 'Thomas Perriniot' },
    });
    assert.deepEqual(
      a.zones.map((z) => z.id),
      ['ouest', 'est'],
    );
    assert.equal(a.zonesDirecteur.length, 2);
    assert.equal(a.zonesDirecteur[0]?.titulaire, 'Simon Ropiot');
    assert.equal(a.zonesDirecteur[0]?.aRevoir, 1);
  });

  it('classe chaque adresse selon le cycle du titulaire', () => {
    const a = apercuSecteur({
      leads: [lead('a', 2.39)],
      zones,
      profileId: 'directeur',
      estDirecteur: true,
      maintenant: MARDI,
      passages: [{ banId: 'ban-a', profileId: MOI, jour: '2026-09-07' }],
    });
    assert.equal(a.points[0]?.niveau, 'semaine');
    assert.equal(a.zonesDirecteur[0]?.aRevoir, 0);
  });

  it('laisse dehors les adresses qu’aucune zone ne couvre', () => {
    const a = apercuSecteur({
      leads: [lead('loin', 2.6)],
      zones,
      profileId: 'directeur',
      estDirecteur: true,
    });
    assert.equal(a.aRevoir, 0);
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
  });
});
