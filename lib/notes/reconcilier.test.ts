import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { proposeReconciliation } from './reconcilier';

const noteA = {
  id: 'n1',
  agencyId: 'a1',
  transcript: 'Le voisin m’a parlé de Jean Dupont au 06 12 34 56 78, 12 rue des Lilas.',
  liens: [] as { entiteType: 'contact' | 'bien' | 'lead' | 'immeuble'; entiteId: string }[],
};

describe('proposeReconciliation', () => {
  it('crée un lien probable, jamais certain', () => {
    const proposals = proposeReconciliation([noteA], {
      agencyId: 'a1',
      entiteType: 'contact',
      entiteId: 'c1',
      needles: ['Jean Dupont', '0612345678', '12 rue des Lilas'],
    });
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0]?.confiance, 'probable');
    assert.equal(proposals[0]?.creePar, 'reconciliation');
    assert.notEqual(proposals[0]?.confiance, 'certain');
  });

  it('isole les agences', () => {
    const proposals = proposeReconciliation([noteA], {
      agencyId: 'a2',
      entiteType: 'contact',
      entiteId: 'c1',
      needles: ['Jean Dupont'],
    });
    assert.equal(proposals.length, 0);
  });

  it('ne relie pas une note déjà rattachée au même type', () => {
    const proposals = proposeReconciliation(
      [{ ...noteA, liens: [{ entiteType: 'contact', entiteId: 'autre' }] }],
      {
        agencyId: 'a1',
        entiteType: 'contact',
        entiteId: 'c1',
        needles: ['Jean Dupont'],
      },
    );
    assert.equal(proposals.length, 0);
  });
});
