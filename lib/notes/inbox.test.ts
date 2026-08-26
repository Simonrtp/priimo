import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { VoiceNote } from '@/types/contact';
import { filterInboxNotes, isHomeNoteWorthy, recentNotesForHome } from './inbox';

function note(partial: Partial<VoiceNote> & { id: string }): VoiceNote {
  return {
    agencyId: 'a',
    createdBy: 'me',
    durationSeconds: null,
    transcript: 'Appel à Dupont rue des Lilas',
    transcriptOriginal: null,
    status: 'transcrit',
    statut: 'brute',
    visibilite: 'agence',
    sourceInfo: null,
    contactId: null,
    banId: null,
    latitude: null,
    longitude: null,
    adresseNormalisee: null,
    assignedTo: null,
    postalCode: null,
    createdAt: '2026-08-26T10:00:00Z',
    hasAudio: true,
    hasFicheLink: false,
    ...partial,
  };
}

describe('filterInboxNotes', () => {
  const notes = [
    note({ id: '1', statut: 'brute', visibilite: 'agence', createdBy: 'me' }),
    note({
      id: '2',
      statut: 'revue',
      visibilite: 'privee',
      createdBy: 'me',
      hasFicheLink: true,
      transcript: 'Visite 12 rue Victor Hugo',
    }),
    note({ id: '3', statut: 'brute', visibilite: 'agence', createdBy: 'other' }),
  ];

  it('filtre mes notes brutes orphelines', () => {
    const out = filterInboxNotes(notes, {
      viewerId: 'me',
      statut: 'brute',
      scope: 'moi',
      period: 'tous',
      rattachement: 'orphelines',
      q: '',
    });
    assert.deepEqual(out.map((n) => n.id), ['1']);
  });

  it('cherche dans le transcript', () => {
    const out = filterInboxNotes(notes, {
      viewerId: 'me',
      statut: 'tous',
      scope: 'moi',
      period: 'tous',
      rattachement: 'tous',
      q: 'hugo',
    });
    assert.deepEqual(out.map((n) => n.id), ['2']);
  });

  it('scope agence exclut les notes privées', () => {
    const out = filterInboxNotes(notes, {
      viewerId: 'me',
      statut: 'tous',
      scope: 'agence',
      period: 'tous',
      rattachement: 'tous',
      q: '',
    });
    assert.deepEqual(out.map((n) => n.id), ['1', '3']);
  });
});

describe('recentNotesForHome', () => {
  it('prend les notes de l’agent, pas celles des collègues', () => {
    const notes = [
      note({ id: 'a', createdBy: 'other' }),
      note({ id: 'b', createdBy: 'me' }),
    ];
    assert.deepEqual(
      recentNotesForHome(notes, {
        viewerId: 'me',
        isDirector: false,
        now: Date.parse('2026-08-26T10:00:00Z'),
        weekStartKey: '2026-08-24',
      }).map((n) => n.id),
      ['b'],
    );
  });

  it('pour un directeur, prend les notes visibles de l’agence', () => {
    const notes = [
      note({ id: 'a', createdBy: 'other' }),
      note({ id: 'b', createdBy: 'me' }),
    ];
    assert.equal(
      recentNotesForHome(notes, {
        viewerId: 'me',
        isDirector: true,
        now: Date.parse('2026-08-26T10:00:00Z'),
        weekStartKey: '2026-08-24',
      }).length,
      2,
    );
  });

  it('masque un transcript trop court ou vide de sens', () => {
    assert.equal(isHomeNoteWorthy('Thank you.'), false);
    assert.equal(isHomeNoteWorthy('ok merci'), false);
    assert.equal(isHomeNoteWorthy('Appel à Dupont rue des Lilas'), true);
  });
});
