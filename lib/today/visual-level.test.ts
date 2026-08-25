import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TodayCard } from './cards';
import {
  isAfternoonProspectionMoment,
  isOverdue,
  level1ContextLine,
  organizeTodayLayout,
  temporalMention,
  visualLevel,
} from './visual-level';

function card(partial: Partial<TodayCard> & Pick<TodayCard, 'key' | 'type' | 'score'>): TodayCard {
  return {
    headline: 'Test',
    context: '',
    action: { kind: 'ouvrir_lead', label: 'Ouvrir', leadId: 'l1' },
    enjeu: 50,
    imminence: 50,
    dismissible: true,
    priority: 0,
    urgent: false,
    ...partial,
  };
}

describe('visualLevel', () => {
  it('attribue les trois niveaux selon le score', () => {
    assert.equal(visualLevel(card({ key: 'a', type: 'promesse', score: 7000 })), 1);
    assert.equal(visualLevel(card({ key: 'b', type: 'relance', score: 4000 })), 2);
    assert.equal(visualLevel(card({ key: 'c', type: 'nouvelle_adresse', score: 900 })), 3);
  });
});

describe('temporalMention', () => {
  it('formule une échéance de mandat', () => {
    const c = card({
      key: 'm',
      type: 'echeance_contractuelle',
      score: 8100,
      context: 'Mandat expire dans 3 jours',
    });
    assert.equal(temporalMention(c), 'Expire dans 3 jours');
  });

  it('formule un retard de promesse', () => {
    const c = card({
      key: 'p',
      type: 'promesse',
      score: 6500,
      context: 'En retard · 2 jours',
    });
    assert.equal(temporalMention(c), 'En retard de 2 jours');
    assert.equal(isOverdue(c), true);
  });
});

describe('level1ContextLine', () => {
  it('apparaît au-delà de 3 cartes niveau 1', () => {
    const burns = Array.from({ length: 4 }, (_, i) =>
      card({
        key: `e${i}`,
        type: 'echeance_contractuelle',
        score: 8000,
        context: 'Mandat expire dans 2 jours',
      }),
    );
    assert.match(level1ContextLine(burns)!, /échéances cette semaine/);
  });
});

describe('organizeTodayLayout', () => {
  const morning = new Date('2026-08-23T09:00:00+02:00');
  const afternoon = new Date('2026-08-23T14:00:00+02:00');

  it('garde la tournée discrète le matin', () => {
    const layout = organizeTodayLayout(
      [
        card({ key: 'u', type: 'echeance_contractuelle', score: 9000 }),
        card({ key: 'r', type: 'relance', score: 3500 }),
        card({ key: 'n', type: 'nouvelle_adresse', score: 600, geo: { latitude: 48.86, longitude: 2.34, address: '1 rue A' } }),
      ],
      morning,
      true,
    );
    assert.equal(layout.level1.length, 1);
    assert.equal(layout.prospection.length, 1);
    assert.equal(layout.showTourneeProminent, false);
  });

  it('remonte la tournée l’après-midi', () => {
    assert.equal(isAfternoonProspectionMoment(afternoon), true);
    const layout = organizeTodayLayout(
      [
        card({ key: 'r', type: 'relance', score: 3500 }),
        card({ key: 'n', type: 'nouvelle_adresse', score: 600, geo: { latitude: 48.86, longitude: 2.34, address: '1 rue A' } }),
      ],
      afternoon,
      true,
    );
    assert.equal(layout.showTourneeProminent, true);
    assert.equal(layout.tourneeHint, 'Bon moment pour sortir');
  });

  it('laisse le niveau 1 au-dessus de tout', () => {
    const layout = organizeTodayLayout(
      [
        card({ key: 'u', type: 'echeance_contractuelle', score: 9000 }),
        card({ key: 'n', type: 'nouvelle_adresse', score: 600, geo: { latitude: 48.86, longitude: 2.34, address: '1 rue A' } }),
      ],
      afternoon,
      true,
    );
    assert.equal(layout.level1.length, 1);
    assert.equal(layout.showTourneeProminent, true);
  });
});
