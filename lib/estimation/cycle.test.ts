import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canChangeReferent, poussePipelineEstimation, tonRapport } from './cycle';

describe('cycle d’estimation', () => {
  it('réserve le changement de référent au directeur', () => {
    assert.equal(canChangeReferent({ id: 'a', role: 'directeur' }), true);
    assert.equal(canChangeReferent({ id: 'a', role: 'collaborateur' }), false);
  });

  it('ne pousse le pipeline que lorsque l’estimation est réalisée', () => {
    assert.equal(poussePipelineEstimation('realisee'), true);
    assert.equal(poussePipelineEstimation('brouillon'), false);
    assert.equal(poussePipelineEstimation('mandat_signe'), false);
  });

  it('une succession exige une date de valeur', () => {
    assert.equal(tonRapport('succession').exigeDateValeur, true);
    assert.equal(tonRapport('projet_vente').exigeDateValeur, false);
  });
});
