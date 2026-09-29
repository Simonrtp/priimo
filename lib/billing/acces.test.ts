import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  abonnementRestreint,
  essaiExpire,
  motifRestriction,
  productionOuverte,
  statutAbonnementDe,
} from './acces';
import type { AgencyBilling } from './acces';

function agency(partial: Partial<AgencyBilling>): AgencyBilling {
  return {
    statut_abonnement: 'actif',
    essai_fin_le: null,
    sieges_inclus: 3,
    prix_base: 149,
    prix_siege_supplementaire: 29,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    demande_decision: 'acceptee',
    ...partial,
  };
}

describe('acces abonnement', () => {
  it('traite une agence sans colonnes comme active', () => {
    assert.equal(statutAbonnementDe({} as AgencyBilling), 'actif');
    assert.equal(productionOuverte({} as AgencyBilling), true);
  });

  it('ferme la production en attente, pas la lecture', () => {
    const a = agency({ statut_abonnement: 'en_attente', demande_decision: 'en_attente' });
    assert.equal(productionOuverte(a), false);
    assert.equal(motifRestriction(a), 'en_attente');
  });

  it('distingue une demande refusée', () => {
    const a = agency({ statut_abonnement: 'en_attente', demande_decision: 'refusee' });
    assert.equal(motifRestriction(a), 'refusee');
  });

  it('laisse la production ouverte après la fin d’essai (facturation hors app)', () => {
    const now = new Date('2026-09-13T10:00:00.000Z');
    const a = agency({
      statut_abonnement: 'essai',
      essai_fin_le: '2026-09-01T00:00:00.000Z',
    });
    assert.equal(essaiExpire(a, now), true);
    assert.equal(productionOuverte(a, now), true);
    assert.equal(abonnementRestreint(a, now), false);
    assert.equal(motifRestriction(a, now), null);
  });

  it('laisse un essai en cours ouvert', () => {
    const now = new Date('2026-09-13T10:00:00.000Z');
    const a = agency({
      statut_abonnement: 'essai',
      essai_fin_le: '2026-09-20T00:00:00.000Z',
    });
    assert.equal(productionOuverte(a, now), true);
  });

  it('laisse impayé et résilié ouverts (retrait = suppression de compte)', () => {
    assert.equal(productionOuverte(agency({ statut_abonnement: 'impaye' })), true);
    assert.equal(productionOuverte(agency({ statut_abonnement: 'resilie' })), true);
    assert.equal(productionOuverte(agency({ statut_abonnement: 'actif' })), true);
  });
});
