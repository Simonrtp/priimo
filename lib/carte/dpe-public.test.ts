import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PUBLIC_DPE_MIN_AGE_MONTHS,
  filterPublicDiagnostics,
  isPublicDpeEligible,
  isPublicDpeTooRecent,
} from './dpe-public';

describe('DPE fraîcheur publique', () => {
  const now = new Date('2026-08-25T12:00:00.000Z');

  it('exporte un seuil unique de 12 mois', () => {
    assert.equal(PUBLIC_DPE_MIN_AGE_MONTHS, 12);
  });

  it('écarte un DPE de moins de 12 mois', () => {
    assert.equal(isPublicDpeTooRecent('2026-02-01', now), true);
    assert.equal(isPublicDpeTooRecent('2025-08-26', now), true);
  });

  it('garde un DPE d’au moins 12 mois', () => {
    assert.equal(isPublicDpeTooRecent('2025-08-25', now), false);
    assert.equal(isPublicDpeTooRecent('2024-01-01', now), false);
  });

  it('exclut un DPE sans date (compteur et étiquette)', () => {
    assert.equal(isPublicDpeEligible(null, now), false);
    assert.equal(isPublicDpeEligible(undefined, now), false);
    assert.equal(isPublicDpeEligible('pas-une-date', now), false);
    assert.equal(isPublicDpeEligible('2024-01-01', now), true);
  });

  it('filtre la liste côté serveur sans toucher aux autres diagnostics', () => {
    const kept = filterPublicDiagnostics(
      [
        { date: '2026-03-01', etiquette: 'D', type: 'DPE' },
        { date: '2024-03-01', etiquette: 'E', type: 'DPE' },
        { date: null, etiquette: 'C', type: 'DPE' },
        { date: '2026-01-01', etiquette: null, type: 'amiante' },
      ],
      now,
    );
    assert.deepEqual(
      kept.map((r) => r.type),
      ['DPE', 'amiante'],
    );
    assert.equal(kept[0]?.etiquette, 'E');
  });
});
