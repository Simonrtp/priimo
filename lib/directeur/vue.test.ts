import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agencesDirecteur, resolveVueAccueilDirecteur } from './vue';

describe('resolveVueAccueilDirecteur', () => {
  it("seul → L'agence par défaut", () => {
    assert.equal(resolveVueAccueilDirecteur({ cookie: null, membresAgence: 1 }), 'directeur');
  });

  it('seul peut forcer Ma semaine', () => {
    assert.equal(
      resolveVueAccueilDirecteur({ cookie: 'agent', membresAgence: 1 }),
      'agent',
    );
  });

  it("équipe → L'agence par défaut", () => {
    assert.equal(resolveVueAccueilDirecteur({ cookie: null, membresAgence: 3 }), 'directeur');
  });
});

describe('agencesDirecteur', () => {
  it('ne garde que les rôles directeur', () => {
    const rows = agencesDirecteur([
      {
        agency_id: '1',
        role: 'collaborateur',
        agency: { id: '1', name: 'A' } as never,
      },
      {
        agency_id: '2',
        role: 'directeur',
        agency: { id: '2', name: 'Beta' } as never,
      },
      {
        agency_id: '3',
        role: 'directeur',
        agency: { id: '3', name: 'Alpha' } as never,
      },
    ]);
    assert.deepEqual(
      rows.map((r) => r.name),
      ['Alpha', 'Beta'],
    );
  });
});
