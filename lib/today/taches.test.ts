import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tachesDuJour } from './taches';
import type { TodayPromesse } from '@/types/metier';

function promesse(id: string, echeance: string, extra: Partial<TodayPromesse> = {}): TodayPromesse {
  return {
    id,
    profileId: 'p1',
    contactId: null,
    contactName: null,
    contactPhone: null,
    intitule: `Tâche ${id}`,
    echeance,
    statut: 'a_faire',
    noteId: null,
    ...extra,
  };
}

// 8 octobre, 10 h à Paris.
const now = new Date('2026-10-08T08:00:00.000Z');
const aucun = new Map<string, string | null>();

describe('tachesDuJour', () => {
  it("garde aujourd'hui et le retard, laisse les jours suivants à la pile", () => {
    const taches = tachesDuJour(
      [promesse('demain', '2026-10-09'), promesse('jour', '2026-10-08'), promesse('hier', '2026-10-07')],
      aucun,
      now,
    );
    assert.deepEqual(
      taches.map((t) => [t.id, t.retardJours]),
      [
        ['hier', 1],
        ['jour', 0],
      ],
    );
  });

  it('compte le jour à Paris, pas en UTC', () => {
    // 8 octobre 23 h 30 UTC = 9 octobre 1 h 30 à Paris.
    const nuit = new Date('2026-10-08T23:30:00.000Z');
    const taches = tachesDuJour([promesse('a', '2026-10-09')], aucun, nuit);
    assert.equal(taches.length, 1);
    assert.equal(taches[0].retardJours, 0);
  });

  it('écarte les tâches faites, reportées ou mises de côté', () => {
    const dismissals = new Map<string, string | null>([
      ['promesse:ignoree', null],
      ['promesse:reportee', '2026-10-09T06:00:00.000Z'],
      ['promesse:revenue', '2026-10-07T06:00:00.000Z'],
    ]);
    const taches = tachesDuJour(
      [
        promesse('faite', '2026-10-08', { statut: 'faite' }),
        promesse('ignoree', '2026-10-08'),
        promesse('reportee', '2026-10-08'),
        promesse('revenue', '2026-10-08'),
      ],
      dismissals,
      now,
    );
    assert.deepEqual(
      taches.map((t) => t.id),
      ['revenue'],
    );
  });

  it("prépare le lien d'appel et la fiche du contact", () => {
    const [t] = tachesDuJour(
      [
        promesse('a', '2026-10-08', {
          contactId: 'c1',
          contactName: 'Janine Morel',
          contactPhone: '06 12 34 56 78',
          noteId: 'n1',
        }),
      ],
      aucun,
      now,
    );
    assert.deepEqual(t.contact, {
      id: 'c1',
      nom: 'Janine Morel',
      telephone: '06 12 34 56 78',
      tel: 'tel:+33612345678',
    });
    assert.equal(t.noteId, 'n1');
  });

  it('sans contact, garde la note pour la relire', () => {
    const [t] = tachesDuJour([promesse('a', '2026-10-08', { noteId: 'n1' })], aucun, now);
    assert.equal(t.contact, null);
    assert.equal(t.noteId, 'n1');
  });
});
