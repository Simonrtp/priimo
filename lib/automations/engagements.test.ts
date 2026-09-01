import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ENGAGEMENTS_CONFIG,
  promesseTenue,
  proposerEngagements,
  type PromesseOuverte,
} from './engagements';

const NOW = new Date('2026-08-31T09:00:00.000Z');

function promesse(over: Partial<PromesseOuverte> = {}): PromesseOuverte {
  return {
    id: 'prom-1',
    profileId: 'agent-1',
    contactId: 'contact-1',
    contactName: 'M. Durand',
    intitule: 'Rappeler pour le compromis',
    echeance: '2026-08-20',
    createdAt: '2026-08-15T10:00:00.000Z',
    ...over,
  };
}

describe('promesseTenue', () => {
  it('voit une trace postérieure à la promesse', () => {
    assert.ok(
      promesseTenue(promesse(), [{ contactId: 'contact-1', occurredAt: '2026-08-21T10:00:00.000Z' }]),
    );
  });

  it('ignore une trace antérieure à la promesse', () => {
    assert.equal(
      promesseTenue(promesse(), [{ contactId: 'contact-1', occurredAt: '2026-08-10T10:00:00.000Z' }]),
      false,
    );
  });

  it('ignore la trace d’un autre contact', () => {
    assert.equal(
      promesseTenue(promesse(), [{ contactId: 'contact-9', occurredAt: '2026-08-21T10:00:00.000Z' }]),
      false,
    );
  });

  it('ne conclut rien sans contact rattaché', () => {
    assert.equal(
      promesseTenue(promesse({ contactId: null }), [
        { contactId: 'contact-1', occurredAt: '2026-08-21T10:00:00.000Z' },
      ]),
      false,
    );
  });
});

describe('proposerEngagements', () => {
  it('propose de clôturer une promesse visiblement tenue', () => {
    const [action] = proposerEngagements({
      promesses: [promesse()],
      interactions: [{ contactId: 'contact-1', occurredAt: '2026-08-21T10:00:00.000Z' }],
      now: NOW,
    });
    assert.match(String(action?.titre), /^Promesse tenue \?/);
    assert.equal(action?.payload.suggestion, 'cloturer');
  });

  it('se tait tant que la carte Aujourd’hui suffit', () => {
    const actions = proposerEngagements({
      promesses: [promesse({ echeance: '2026-08-30' })],
      interactions: [],
      now: NOW,
    });
    assert.equal(actions.length, 0, 'un retard d’un jour ne mérite pas de doublon');
  });

  it('escalade au-delà du seuil de retard', () => {
    const [action] = proposerEngagements({
      promesses: [promesse({ echeance: '2026-08-25' })],
      interactions: [],
      now: NOW,
    });
    assert.equal(action?.titre, 'Vous aviez dit : Rappeler pour le compromis');
    assert.equal(action?.payload.joursDeRetard, 6);
    assert.equal(action?.payload.suggestion, 'tenir');
  });

  it('monte le ton avec le retard', () => {
    const petit = proposerEngagements({
      promesses: [promesse({ echeance: '2026-08-27' })],
      interactions: [],
      now: NOW,
    });
    const gros = proposerEngagements({
      promesses: [promesse({ echeance: '2026-08-20' })],
      interactions: [],
      now: NOW,
    });
    assert.ok((gros[0]?.score ?? 0) > (petit[0]?.score ?? 0));
  });

  it('demande de trancher une promesse abandonnée', () => {
    const [action] = proposerEngagements({
      promesses: [promesse({ echeance: '2026-06-01' })],
      interactions: [],
      now: NOW,
    });
    assert.match(String(action?.titre), /Promesse oubliée depuis \d+ jours/);
    assert.equal(action?.payload.suggestion, 'trancher');
  });

  it('revient chaque jour tant que la promesse traîne, mais une seule fois par jour', () => {
    const matin = proposerEngagements({
      promesses: [promesse({ echeance: '2026-08-25' })],
      interactions: [],
      now: new Date('2026-08-31T08:00:00.000Z'),
    });
    const soir = proposerEngagements({
      promesses: [promesse({ echeance: '2026-08-25' })],
      interactions: [],
      now: new Date('2026-08-31T19:00:00.000Z'),
    });
    const demain = proposerEngagements({
      promesses: [promesse({ echeance: '2026-08-25' })],
      interactions: [],
      now: new Date('2026-09-01T08:00:00.000Z'),
    });

    assert.equal(matin[0]?.dedupKey, soir[0]?.dedupKey);
    assert.notEqual(matin[0]?.dedupKey, demain[0]?.dedupKey);
  });

  it('adresse la proposition à celui qui a promis', () => {
    const [action] = proposerEngagements({
      promesses: [promesse({ echeance: '2026-08-25', profileId: 'agent-7' })],
      interactions: [],
      now: NOW,
    });
    assert.equal(action?.assignedTo, 'agent-7');
  });

  it('plafonne le volume', () => {
    const promesses = Array.from({ length: 20 }, (_, i) =>
      promesse({ id: `prom-${i}`, echeance: '2026-08-20' }),
    );
    const actions = proposerEngagements({ promesses, interactions: [], now: NOW });
    assert.equal(actions.length, ENGAGEMENTS_CONFIG.maxPropositions);
  });
});
