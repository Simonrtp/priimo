import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pipelineVictoryKind } from './victories';

describe('pipelineVictoryKind', () => {
  const contacte = { id: 'a', cle: 'contacte', type: 'intermediaire' as const };
  const rdv = { id: 'b', cle: 'rendez_vous', type: 'intermediaire' as const };
  const mandat = { id: 'c', cle: 'mandat', type: 'gagne' as const };

  it('célèbre un rendez-vous', () => {
    assert.equal(pipelineVictoryKind(contacte, rdv), 'rendez_vous');
  });

  it('célèbre un mandat signé', () => {
    assert.equal(pipelineVictoryKind(rdv, mandat), 'mandat');
  });

  it('ignore un réordonnancement dans la même colonne', () => {
    assert.equal(pipelineVictoryKind(rdv, rdv), null);
  });
});
