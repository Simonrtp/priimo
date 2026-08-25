import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatPriseLine, priseStats } from './prise.js';

describe('priseStats', () => {
  it('compte livrés et pris du mois courant', () => {
    const now = new Date('2026-08-24T12:00:00+02:00');
    const stats = priseStats(
      [
        { deliveredAt: '2026-08-01', stageId: null },
        { deliveredAt: '2026-08-12', stageId: 's1' },
        { deliveredAt: '2026-07-31', stageId: 's1' },
      ],
      now,
    );
    assert.equal(stats.delivered, 2);
    assert.equal(stats.pris, 1);
    assert.equal(stats.pct, 50);
  });

  it('formate la ligne KPI', () => {
    assert.equal(
      formatPriseLine({ delivered: 10, pris: 4, pct: 40 }),
      '10 leads livrés ce mois · 4 pris (40 %)',
    );
  });
});
