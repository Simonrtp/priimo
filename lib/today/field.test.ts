import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dictationStreak } from './streak';
import { phraseEtat } from './field';
import { buildFieldWeek } from './semaine';
import { summarizeTodayCards } from './cards';

/** Samedi 22 août 2026, 10h Paris (UTC+2). */
const SAMEDI = new Date('2026-08-22T08:00:00.000Z');
/** Dimanche 23 août 2026. */
const DIMANCHE = new Date('2026-08-23T08:00:00.000Z');
/** Lundi 24 août 2026. */
const LUNDI = new Date('2026-08-24T08:00:00.000Z');

describe('dictationStreak', () => {
  it('vaut 0 sans note', () => {
    assert.equal(dictationStreak([], SAMEDI), 0);
  });

  it('compte les jours ouvrés consécutifs', () => {
    assert.equal(dictationStreak(['2026-08-21', '2026-08-22'], SAMEDI), 2);
  });

  it('ignore le dimanche : il ne casse jamais la série', () => {
    assert.equal(dictationStreak(['2026-08-21', '2026-08-22'], DIMANCHE), 2);
    assert.equal(dictationStreak(['2026-08-21', '2026-08-22', '2026-08-24'], LUNDI), 3);
  });

  it('casse sur un jour ouvré sans note', () => {
    assert.equal(dictationStreak(['2026-08-20'], SAMEDI), 0);
  });

  it('ne casse pas si aujourd’hui est ouvré sans note encore', () => {
    assert.equal(dictationStreak(['2026-08-21', '2026-08-22'], LUNDI), 2);
  });
});

describe('phraseEtat', () => {
  it('formule la charge restante', () => {
    assert.equal(
      phraseEtat({ remaining: 4, prenom: 'Simon', emptyKind: null }),
      'Bonjour Simon. 4 à traiter.',
    );
    assert.equal(phraseEtat({ remaining: 2, prenom: 'Simon', emptyKind: null }), 'Plus que 2.');
    assert.equal(
      phraseEtat({ remaining: 0, prenom: 'Simon', emptyKind: 'bouclee' }),
      'Journée bouclée.',
    );
    assert.equal(
      phraseEtat({ remaining: 0, prenom: 'Simon', emptyKind: 'rien' }),
      'Rien de prévu aujourd’hui',
    );
  });
});

describe('buildFieldWeek', () => {
  it('ne compte que la semaine en cours', () => {
    const week = buildFieldWeek({
      noteCreatedAt: ['2026-08-14T10:00:00.000Z', '2026-08-21T10:00:00.000Z'],
      noteBanIds: ['ban-1', 'ban-2'],
      contactCreatedAt: ['2026-08-21T12:00:00.000Z'],
      leadDeliveredAt: ['2026-08-20T08:00:00.000Z', '2026-08-10T08:00:00.000Z'],
      now: SAMEDI,
    });
    assert.equal(week.notes, 1);
    assert.equal(week.contacts, 1);
    assert.equal(week.immeubles, 1);
    assert.equal(week.adressesDetectees, 1);
  });
});

describe('types vides', () => {
  it('ne résume aucun type absent', () => {
    assert.deepEqual(summarizeTodayCards([]), []);
  });
});
