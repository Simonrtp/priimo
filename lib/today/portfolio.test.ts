import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPortfolioStats, countRendezVousSansSuite } from './portfolio';

const NOW = Date.parse('2026-08-26T12:00:00Z');

describe('portfolio', () => {
  it('compte mandats signés, exclusifs et leads non pris', () => {
    const stats = buildPortfolioStats({
      estimationStageId: null,
      rendezVousSansSuite: 2,
      leads: [{ stageId: null }, { stageId: 'pris' }, { stageId: null }],
      biens: [
        {
          id: 'a',
          mandatStatut: 'mandat_exclusif',
          mandatDate: '2026-05-01',
          createdAt: '2026-05-01',
        },
        {
          id: 'b',
          mandatStatut: 'mandat_simple',
          mandatDate: '2026-08-01',
          createdAt: '2026-08-01',
        },
        {
          id: 'c',
          mandatStatut: 'estimation',
          mandatDate: '2026-01-01',
          createdAt: '2026-01-01',
        },
      ],
    });
    const byKind = Object.fromEntries(stats.counters.map((c) => [c.kind, c]));
    assert.equal(byKind['mandats-actifs']?.value, 2);
    assert.equal(byKind['mandats-actifs']?.subtitle, '1 exclusif');
    assert.equal(byKind['mandats-actifs']?.subtitleHref, '/dashboard/biens?filtre=mandats-exclusifs');
    assert.equal(byKind['leads-non-pris']?.value, 2);
    assert.equal(byKind['leads-non-pris']?.tone, 'probleme');
    assert.equal(byKind['rdv-sans-suite']?.value, 2);
    assert.equal(byKind['rdv-sans-suite']?.label, 'Rendez-vous sans suite');
    assert.equal(byKind['mandats-60j'], undefined);
    assert.equal(stats.counters.length, 3);
    assert.equal(byKind['mandats-actifs']?.deltaLabel, null);
  });

  it('ignore un RDV suivi d’une interaction', () => {
    const n = countRendezVousSansSuite(
      [
        { contactId: 'c1', fin: '2026-08-01T10:00:00Z' },
        { contactId: 'c2', fin: '2026-08-01T10:00:00Z' },
      ],
      { c1: '2026-08-10T10:00:00Z', c2: '2026-07-01T10:00:00Z' },
      NOW,
    );
    assert.equal(n, 1);
  });
});
