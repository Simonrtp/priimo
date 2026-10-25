import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { journalVide } from './derive';
import { etatsSecteurs, touchesPeriode } from './secteurs-travailles';
import { adresseAJuger } from '@/lib/zones/adresse';
import type { RegleZone, Zone } from '@/lib/zones/types';

const MOI = 'profil-moi';
const SEMAINE = { debut: '2026-09-01', fin: '2026-09-07' };

function zone(partiel: Partial<Zone> & { regles: readonly RegleZone[] }): Zone {
  return {
    id: 'z',
    agencyId: 'ag',
    nom: 'Secteur',
    couleur: '#E8743C',
    assignedTo: MOI,
    joursSemaine: [],
    actif: true,
    verrouillee: false,
    ...partiel,
  };
}

function regle(partiel: Omit<RegleZone, 'id' | 'zoneId' | 'inclusion'> & { inclusion?: boolean }): RegleZone {
  return { id: 'r', zoneId: 'z', inclusion: true, ...partiel } as RegleZone;
}

describe('touchesPeriode', () => {
  it('retient une sortie, une note rattachée et un contact sur une adresse', () => {
    const t = touchesPeriode({
      profileIds: new Set([MOI]),
      intervalle: SEMAINE,
      journal: {
        ...journalVide(),
        notes: [
          {
            id: 'n1',
            auteurId: MOI,
            createdAt: '2026-09-02T09:00:00Z',
            banId: 'ban-note',
            rattacheeTerrain: true,
            echange: false,
          },
          {
            id: 'n2',
            auteurId: MOI,
            createdAt: '2026-09-02T10:00:00Z',
            banId: null,
            rattacheeTerrain: false,
            echange: true,
          },
        ],
        contactsPhysiques: [{ profileId: MOI, jour: '2026-09-03', banId: 'ban-porte' }],
        transitions: [
          {
            leadId: 'l1',
            profileId: MOI,
            depuisCle: null,
            versCle: 'contacte',
            createdAt: '2026-09-04T09:00:00Z',
            banId: 'ban-contact',
          },
          {
            leadId: 'l2',
            profileId: MOI,
            depuisCle: null,
            versCle: 'pris',
            createdAt: '2026-09-04T10:00:00Z',
            banId: 'ban-pris',
          },
        ],
      },
    });

    assert.deepEqual(t.banIds.sort(), ['ban-contact', 'ban-note', 'ban-porte']);
    assert.deepEqual(t.noteIds, ['n1', 'n2']);
  });
});

describe('etatsSecteurs', () => {
  const belleville = zone({
    id: 'belleville',
    nom: 'Belleville',
    regles: [regle({ type: 'code_postal', valeur: { code_postal: '75020' } })],
  });
  const nation = zone({
    id: 'nation',
    nom: 'Nation',
    couleur: '#3366CC',
    regles: [regle({ type: 'code_postal', valeur: { code_postal: '75011' } })],
  });

  it('passe le secteur touché à travaillé et laisse l’autre en manque', () => {
    const etats = etatsSecteurs({
      zones: [belleville, nation],
      adresses: [adresseAJuger({ address: '12 Rue de Bagnolet 75020 Paris' })],
    });
    assert.deepEqual(
      etats.map((e) => [e.nom, e.travaille]),
      [
        ['Belleville', true],
        ['Nation', false],
      ],
    );
  });

  it('un secteur sans geste reste non travaillé', () => {
    const etats = etatsSecteurs({ zones: [belleville], adresses: [] });
    assert.equal(etats[0]?.travaille, false);
  });
});
