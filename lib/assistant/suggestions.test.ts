import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSuggestions, questionForSuggestion } from './suggestions';

describe('buildSuggestions', () => {
  const viewer = { id: 'u1', role: 'directeur' as const };

  it('propose une adresse de lead quand la saisie correspond au début', () => {
    const items = buildSuggestions(
      '13',
      {
        leads: [
          {
            id: 'l1',
            address: '13 rue des Mûriers',
            city: 'Paris',
            postal_code: '75020',
            adresse_normalisee: '13 Rue des Mûriers 75020 Paris',
            assigned_to: null,
          },
        ],
        contacts: [],
        biens: [],
      },
      viewer,
    );
    assert.equal(items.length, 1);
    assert.match(items[0]?.label ?? '', /13 rue des Mûriers/i);
    assert.equal(items[0]?.kind, 'lead');
  });

  it('cache le lead d’un collègue à un collaborateur', () => {
    const collab = { id: 'c1', role: 'collaborateur' as const };
    const items = buildSuggestions(
      '13',
      {
        leads: [
          {
            id: 'l1',
            address: '13 rue des Mûriers',
            city: 'Paris',
            postal_code: '75020',
            assigned_to: 'other',
          },
        ],
        contacts: [],
        biens: [],
      },
      collab,
    );
    assert.equal(items.length, 0);
  });
});

describe('questionForSuggestion', () => {
  it('formule une question immeuble', () => {
    const q = questionForSuggestion({
      id: '1',
      kind: 'lead',
      label: '13 rue des Mûriers, 75020 Paris',
      subtitle: 'Prospect',
      href: '/dashboard/prospection?lead=1',
    });
    assert.match(q, /13 rue des Mûriers/);
  });
});
