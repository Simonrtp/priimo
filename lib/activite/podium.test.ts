import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { journalVide } from './derive';
import { podiumSemaine } from './podium';

const semaine = { debut: '2026-09-01', fin: '2026-09-07' };

describe('podiumSemaine', () => {
  it('garde le collaborateur sans aucune action, derrière ceux qui ont agi', () => {
    const journal = journalVide();
    journal.notes = [
      {
        auteurId: 'actif',
        createdAt: '2026-09-02T09:00:00Z',
        banId: null,
        rattacheeTerrain: true,
        echange: false,
      },
    ];

    const podium = podiumSemaine(
      journal,
      [
        { id: 'calme', prenom: 'Calme', nom: 'Martin', avatarUrl: null },
        { id: 'actif', prenom: 'Actif', nom: 'Bernard', avatarUrl: null },
      ],
      semaine,
    );

    assert.deepEqual(
      podium.map((agent) => [agent.id, agent.score]),
      [
        ['actif', 1],
        ['calme', 0],
      ],
    );
  });
});
