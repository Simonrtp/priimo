import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countLeadsCreatedAfter,
  pipelineBannerBatchKey,
  shouldShowPipelineBanner,
  texteNouveauxLeads,
} from '@/lib/lead-delivery';

describe('bandeau nouveaux leads', () => {
  it('ne s’affiche pas sans dernière visite', () => {
    assert.equal(shouldShowPipelineBanner([{ createdAt: '2026-10-27T10:00:00.000Z' }], null), false);
    assert.equal(countLeadsCreatedAfter([{ createdAt: '2026-10-27T10:00:00.000Z' }], null), 0);
  });

  it('compte seulement les leads après la dernière visite', () => {
    const leads = [
      { createdAt: '2026-10-26T10:00:00.000Z' },
      { createdAt: '2026-10-27T09:00:00.000Z' },
      { createdAt: '2026-10-27T11:00:00.000Z' },
    ];
    assert.equal(countLeadsCreatedAfter(leads, '2026-10-27T10:00:00.000Z'), 1);
    assert.equal(shouldShowPipelineBanner(leads, '2026-10-27T10:00:00.000Z'), true);
    assert.equal(shouldShowPipelineBanner(leads, '2026-10-27T12:00:00.000Z'), false);
  });

  it('expose la clé du lot le plus récent', () => {
    assert.equal(
      pipelineBannerBatchKey([
        { createdAt: '2026-10-26T10:00:00.000Z' },
        { createdAt: '2026-10-27T11:00:00.000Z' },
      ]),
      '2026-10-27T11:00:00.000Z',
    );
  });

  it('rédige le texte demandé', () => {
    assert.equal(
      texteNouveauxLeads(3),
      '3 nouveaux leads dans 3 nouvelles annonces détectées sur votre secteur',
    );
    assert.equal(
      texteNouveauxLeads(1),
      '1 nouveau lead dans 1 nouvelle annonce détectée sur votre secteur',
    );
  });
});
