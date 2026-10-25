import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { derniereNoteDeLaPeriode, ligneDerniereNote, type NotePourLigne } from './derniere-ligne';

const maintenant = Date.parse('2026-10-25T12:00:00Z');

function note(partiel: Partial<NotePourLigne> & Pick<NotePourLigne, 'createdAt'>): NotePourLigne {
  return {
    createdBy: 'lea',
    author: { firstName: 'Léa' },
    authorName: 'Léa Martin',
    adresseNormalisee: null,
    rattachements: [],
    ...partiel,
  };
}

describe('ligneDerniereNote', () => {
  it('aligne le prénom, l’adresse rattachée et le moment', () => {
    const ligne = ligneDerniereNote(
      note({
        createdAt: '2026-10-25T10:00:00Z',
        rattachements: [{ type: 'immeuble', label: '12 rue de la Paix' }],
      }),
      maintenant,
    );
    assert.equal(ligne, 'Léa · 12 rue de la Paix · Il y a 2 h');
  });

  it('omet l’adresse quand la note n’est pas posée sur un lieu', () => {
    const ligne = ligneDerniereNote(
      note({
        createdAt: '2026-10-25T11:30:00Z',
        rattachements: [{ type: 'contact', label: 'Marc' }],
      }),
      maintenant,
    );
    assert.equal(ligne, 'Léa · Il y a 30 min');
  });
});

describe('derniereNoteDeLaPeriode', () => {
  const intervalle = { debut: '2026-10-19', fin: '2026-10-25' };

  it('garde la plus récente de la personne, dans la période', () => {
    const recente = note({ createdAt: '2026-10-24T18:00:00Z' });
    const ancienne = note({ createdAt: '2026-10-20T08:00:00Z' });
    const autre = note({ createdAt: '2026-10-25T09:00:00Z', createdBy: 'marc', author: { firstName: 'Marc' } });
    const hors = note({ createdAt: '2026-09-01T09:00:00Z' });
    const choisie = derniereNoteDeLaPeriode([ancienne, hors, autre, recente], {
      membreId: 'lea',
      intervalle,
    });
    assert.equal(choisie?.createdAt, recente.createdAt);
  });
});
