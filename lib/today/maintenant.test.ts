import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TodayCard } from './cards';
import { tacheDuMoment } from './maintenant';

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

describe('tacheDuMoment', () => {
  it('rien à afficher sur une journée vide', () => {
    assert.equal(tacheDuMoment([]), null);
  });

  it('le rendez-vous en cours passe devant un plus gros enjeu', () => {
    const choisie = tacheDuMoment([
      card({ key: 'estim', type: 'demande_estimation', score: 9400, imminence: 100 }),
      card({ key: 'rdv:1', type: 'rendez_vous', score: 5000, imminence: 100 }),
    ]);
    assert.equal(choisie?.key, 'rdv:1');
  });

  it('un rendez-vous de demain ne prend pas la place', () => {
    const choisie = tacheDuMoment([
      card({ key: 'estim', type: 'demande_estimation', score: 9400, imminence: 100 }),
      card({ key: 'rdv:1', type: 'rendez_vous', score: 4000, imminence: 80 }),
    ]);
    assert.equal(choisie?.key, 'estim');
  });

  it('sans horaire, c’est le meilleur score qui sort', () => {
    const choisie = tacheDuMoment([
      card({ key: 'a', type: 'relance', score: 1200 }),
      card({ key: 'b', type: 'echeance_contractuelle', score: 8100 }),
      card({ key: 'c', type: 'nouvelle_adresse', score: 900 }),
    ]);
    assert.equal(choisie?.key, 'b');
  });

  it('garde le rendez-vous le plus proche quand il y en a deux', () => {
    const choisie = tacheDuMoment([
      card({ key: 'rdv:tard', type: 'rendez_vous', score: 4750, imminence: 95 }),
      card({ key: 'rdv:encours', type: 'rendez_vous', score: 5000, imminence: 100 }),
    ]);
    assert.equal(choisie?.key, 'rdv:encours');
  });
});
