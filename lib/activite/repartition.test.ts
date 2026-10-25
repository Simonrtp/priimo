import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detailCompteur, detailSecteurs, type RepartitionEquipe } from './repartition';

function ligne(
  prenom: string,
  contacts: number,
  notes: number,
  secteursTravailles = 0,
  secteursTotal = 0,
): RepartitionEquipe {
  return { prenom, contacts, notes, secteursTravailles, secteursTotal };
}

describe('detailCompteur', () => {
  it('met en tête ceux qui en ont fait, et nomme ceux qui n’en ont pas fait', () => {
    const detail = detailCompteur(
      [ligne('Léa', 1, 0), ligne('Marc', 6, 2), ligne('Inès', 0, 0)],
      'contacts',
    );
    assert.deepEqual(
      detail.lignes.map((l) => l.prenom),
      ['Marc', 'Léa'],
    );
    assert.equal(detail.suite, 'Inès n’en a pas fait');
  });

  it('résume quand trop de monde n’en a pas fait', () => {
    const equipe = [
      ligne('Marc', 4, 0),
      ...['A', 'B', 'C', 'D'].map((p) => ligne(p, 0, 0)),
    ];
    const detail = detailCompteur(equipe, 'contacts');
    assert.equal(detail.lignes.length, 1);
    assert.equal(detail.suite, '4 n’en ont pas fait');
  });
});

describe('detailSecteurs', () => {
  it('ne liste pas les secteurs, seulement la personne et son compte', () => {
    const detail = detailSecteurs([
      ligne('Léa', 0, 0, 2, 2),
      ligne('Marc', 0, 0, 0, 3),
      ligne('Inès', 0, 0, 0, 0),
    ]);
    assert.deepEqual(detail.lignes, [
      { prenom: 'Marc', valeur: 'Aucun' },
      { prenom: 'Léa', valeur: '2/2' },
    ]);
    assert.equal(detail.suite, null);
  });

  it('coupe au-delà de quatre personnes', () => {
    const equipe = ['A', 'B', 'C', 'D', 'E', 'F'].map((p) => ligne(p, 0, 0, 0, 1));
    const detail = detailSecteurs(equipe);
    assert.equal(detail.lignes.length, 4);
    assert.equal(detail.suite, 'et 2 autres');
  });
});
