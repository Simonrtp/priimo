import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fractionalPosition, nextStagePosition, positionNeighbors } from './position.js';

describe('fractionalPosition', () => {
  it('colonne vide → 1000', () => {
    assert.equal(fractionalPosition(null, null), 1000);
  });

  it('première carte = suivante - 1', () => {
    assert.equal(fractionalPosition(null, 3000), 2999);
  });

  it('dernière carte = précédente + 1', () => {
    assert.equal(fractionalPosition(2000, null), 2001);
  });

  it('entre deux cartes = moyenne', () => {
    assert.equal(fractionalPosition(1000, 2000), 1500);
  });
});

describe('positionNeighbors', () => {
  const cards = [
    { id: 'a', stagePosition: 1000 },
    { id: 'b', stagePosition: 2000 },
    { id: 'c', stagePosition: 3000 },
  ];

  it('insertion en tête ignore la carte déplacée', () => {
    const n = positionNeighbors(cards, 0, 'b');
    assert.deepEqual(n, { previous: null, next: 1000 });
  });

  it('insertion en queue', () => {
    const n = positionNeighbors(cards, 3, 'x');
    assert.deepEqual(n, { previous: 3000, next: null });
  });
});

describe('nextStagePosition', () => {
  it('colonne vide → 1000', () => {
    assert.equal(nextStagePosition([{ stageId: 'a', stagePosition: 1 }], 'b'), 1000);
  });

  it('dernière carte = max + 1', () => {
    assert.equal(
      nextStagePosition(
        [
          { stageId: 'a', stagePosition: 1000 },
          { stageId: 'a', stagePosition: 2500 },
        ],
        'a',
      ),
      2501,
    );
  });
});
