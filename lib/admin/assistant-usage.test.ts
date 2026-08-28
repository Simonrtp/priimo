import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  agregerUsage,
  formeDeQuestion,
  formesFrequentes,
  moisDe,
  type MessageAgrege,
} from './assistant-usage';

const noms = new Map([
  ['a1', 'Agence Nord'],
  ['a2', 'Agence Sud'],
]);

function msg(over: Partial<MessageAgrege> = {}): MessageAgrege {
  return {
    agencyId: 'a1',
    conversationId: 'c1',
    createdAt: '2026-08-10T09:00:00Z',
    tokens: 100,
    ...over,
  };
}

describe('agregerUsage', () => {
  it('additionne les tokens par agence et par mois', () => {
    const rows = agregerUsage(
      [
        msg(),
        msg({ tokens: 50, conversationId: 'c2' }),
        msg({ agencyId: 'a2', tokens: 20, conversationId: 'c3' }),
        msg({ createdAt: '2026-07-02T09:00:00Z', tokens: 10, conversationId: 'c4' }),
      ],
      noms,
    );

    const aout = rows.find((r) => r.agencyId === 'a1' && r.mois === '2026-08');
    assert.equal(aout?.tokens, 150);
    assert.equal(aout?.messages, 2);
    assert.equal(aout?.conversations, 2);
    assert.equal(aout?.agencyName, 'Agence Nord');
    assert.equal(rows.find((r) => r.agencyId === 'a2')?.tokens, 20);
    assert.equal(rows.find((r) => r.mois === '2026-07')?.tokens, 10);
  });

  it('trie du mois le plus récent au plus ancien', () => {
    const rows = agregerUsage(
      [msg({ createdAt: '2026-06-01T00:00:00Z' }), msg({ createdAt: '2026-09-01T00:00:00Z' })],
      noms,
    );
    assert.equal(rows[0]!.mois, '2026-09');
  });

  it('nomme les agences inconnues sans planter', () => {
    const rows = agregerUsage([msg({ agencyId: 'zz' })], noms);
    assert.equal(rows[0]!.agencyName, 'Agence inconnue');
  });

  it('cadre le mois en UTC', () => {
    assert.equal(moisDe('2026-01-31T23:30:00Z'), '2026-01');
    assert.equal(moisDe('pas une date'), 'inconnu');
  });
});

describe('formesFrequentes', () => {
  it('regroupe sur les cinq premiers mots normalisés', () => {
    assert.equal(
      formeDeQuestion("Qu'est-ce qu'on sait du 27 rue Alphonse Penaud ?"),
      'qu est ce qu on',
    );
    assert.equal(formeDeQuestion('Combien de leads ce mois ?'), 'combien de leads ce mois');
  });

  it('compte les occurrences et les questions restées sans ligne', () => {
    const formes = formesFrequentes([
      { question: 'Combien de leads ce mois ?', lignesCount: 4 },
      { question: 'combien de leads ce mois', lignesCount: 0 },
      { question: 'Qui cherche dans le 75020 ?', lignesCount: 2 },
    ]);
    assert.equal(formes[0]!.occurrences, 2);
    assert.equal(formes[0]!.sansResultat, 1);
    assert.equal(formes.length, 2);
  });

  it('plafonne la liste', () => {
    const questions = Array.from({ length: 60 }, (_, i) => ({
      question: `question numero ${i} distincte ici`,
      lignesCount: 1,
    }));
    assert.equal(formesFrequentes(questions).length, 25);
  });
});
