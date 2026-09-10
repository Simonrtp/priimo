import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { journalVide } from '@/lib/activite/derive';
import { passagesDepuisJournal } from './passages';

describe('passages observés', () => {
  it('ignore une note sans rattachement terrain', () => {
    const journal = journalVide();
    const p = passagesDepuisJournal({
      ...journal,
      notes: [
        {
          auteurId: 'moi',
          createdAt: '2026-09-01T10:00:00Z',
          banId: 'ban-1',
          rattacheeTerrain: false,
        },
      ],
    });
    assert.deepEqual(p, []);
  });

  it('prend une rencontre, une note de terrain et un changement de statut', () => {
    const journal = journalVide();
    const p = passagesDepuisJournal({
      ...journal,
      contactsPhysiques: [{ profileId: 'moi', jour: '2026-09-01', banId: 'a' }],
      notes: [
        {
          auteurId: 'moi',
          createdAt: '2026-09-02T12:00:00Z',
          banId: 'b',
          rattacheeTerrain: true,
        },
      ],
      transitions: [
        {
          leadId: 'l',
          profileId: 'moi',
          depuisCle: 'pris',
          versCle: 'contacte',
          createdAt: '2026-09-03T09:00:00Z',
          banId: 'c',
        },
      ],
    });
    assert.deepEqual(
      p.map((x) => x.banId).sort(),
      ['a', 'b', 'c'],
    );
  });

  it('ne compte qu’une fois le même immeuble le même jour', () => {
    const journal = journalVide();
    const p = passagesDepuisJournal({
      ...journal,
      contactsPhysiques: [
        { profileId: 'moi', jour: '2026-09-01', banId: 'a' },
        { profileId: 'moi', jour: '2026-09-01', banId: 'a' },
      ],
    });
    assert.equal(p.length, 1);
  });
});
