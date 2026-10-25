import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { journalVide, type JournalActivite } from '@/lib/activite/derive';
import { objectifsEffectifs, type ObjectifRow } from '@/lib/activite/objectifs';
import { famillesAgence } from './familles';

const A = 'profil-a';
const B = 'profil-b';
const SEMAINE = { debut: '2026-09-01', fin: '2026-09-07' };

function journal(partiel: Partial<JournalActivite>): JournalActivite {
  return { ...journalVide(), ...partiel };
}

describe('famillesAgence', () => {
  it('additionne les compteurs et les objectifs de la période', () => {
    const objectifsA = objectifsEffectifs([
      { activite: 'contacts_qualifies', periode: 'hebdo', cible: 4 },
    ] satisfies ObjectifRow[]);
    const objectifsB = objectifsEffectifs([
      { activite: 'contacts_qualifies', periode: 'hebdo', cible: 6 },
    ] satisfies ObjectifRow[]);

    const familles = famillesAgence({
      profileIds: [A, B],
      objectifs: [objectifsA, objectifsB],
      intervalle: SEMAINE,
      journal: journal({
        transitions: [
          {
            leadId: 'lead-a',
            profileId: A,
            depuisCle: null,
            versCle: 'contacte',
            createdAt: '2026-09-02T09:00:00Z',
            banId: 'a',
          },
          {
            leadId: 'lead-b',
            profileId: B,
            depuisCle: null,
            versCle: 'contacte',
            createdAt: '2026-09-03T09:00:00Z',
            banId: 'b',
          },
        ],
        notes: [
          {
            auteurId: B,
            createdAt: '2026-09-04T09:00:00Z',
            banId: 'b',
            rattacheeTerrain: true,
            echange: false,
          },
        ],
      }),
    });

    const contacts = familles.find((f) => f.activite === 'contacts_qualifies')!;
    const notes = familles.find((f) => f.activite === 'informations_terrain')!;
    assert.equal(contacts.valeur, 2);
    assert.equal(contacts.objectif, 10);
    assert.equal(contacts.libelle, 'Nouveaux contacts');
    assert.equal(notes.valeur, 1);
    assert.equal(notes.libelle, 'Notes terrain');
  });

  it('proratise l’objectif quand la période dure deux semaines', () => {
    const familles = famillesAgence({
      profileIds: [A],
      objectifs: [objectifsEffectifs([{ activite: 'estimations', periode: 'hebdo', cible: 3 }])],
      intervalle: { debut: '2026-09-01', fin: '2026-09-14' },
      journal: journalVide(),
    });
    const estimations = familles.find((f) => f.activite === 'estimations')!;
    assert.equal(estimations.valeur, 0);
    assert.equal(estimations.objectif, 6);
    assert.equal(estimations.etatSource, 'muette');
  });
});
