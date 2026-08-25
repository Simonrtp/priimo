import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Bien } from '../../types/bien';
import type { Contact } from '../../types/contact';
import type { Lead } from '../../types/lead';
import {
  buildAgencyOverview,
  buildMemberActivity,
  buildSectorCoverage,
  countSleeping,
} from './agency-overview';

const NOW = Date.parse('2026-08-20T12:00:00.000Z');

function daysAgo(n: number): string {
  return new Date(NOW - n * 86_400_000).toISOString();
}

describe('buildMemberActivity', () => {
  it('trie par volume et laisse les zéros visibles', () => {
    const rows = buildMemberActivity(
      [
        { id: 'marie', fullName: 'Marie Curie' },
        { id: 'paul', fullName: 'Paul Martin' },
        { id: 'lea', fullName: 'Léa Nul' },
      ],
      [
        { createdBy: 'marie', createdAt: daysAgo(1) },
        { createdBy: 'marie', createdAt: daysAgo(2) },
        { createdBy: 'paul', createdAt: daysAgo(20) },
      ],
      [
        { createdBy: 'paul', createdAt: daysAgo(1) } as Pick<Contact, 'createdBy' | 'createdAt'>,
      ],
      [{ authorId: 'marie', occurredAt: daysAgo(0) }],
      NOW,
    );
    assert.deepEqual(
      rows.map((r) => r.memberId),
      ['marie', 'paul', 'lea'],
    );
    assert.equal(rows[0]?.volume, 3);
    assert.equal(rows[1]?.contacts, 1);
    assert.equal(rows[2]?.volume, 0);
  });
});

describe('buildSectorCoverage', () => {
  it('compte les immeubles distincts et signale un secteur endormi', () => {
    const rows = buildSectorCoverage(
      ['59000', '59100'],
      [
        { banId: 'ban-1', postalCode: '59000', occurredAt: daysAgo(3) },
        { banId: 'ban-1', postalCode: '59000', occurredAt: daysAgo(1) },
        { banId: 'ban-2', postalCode: '59000', occurredAt: daysAgo(10) },
        { banId: 'ban-3', postalCode: '59100', occurredAt: daysAgo(80) },
      ],
      NOW,
    );
    assert.equal(rows[0]?.postalCode, '59000');
    assert.equal(rows[0]?.buildingCount, 2);
    assert.equal(rows[0]?.stale, false);
    assert.equal(rows[1]?.postalCode, '59100');
    assert.equal(rows[1]?.buildingCount, 1);
    assert.equal(rows[1]?.stale, true);
  });
});

describe('countSleeping', () => {
  it('compte les trois files d’attente du directeur', () => {
    const sleeping = countSleeping(
      [
        { assignedTo: null, deliveredAt: daysAgo(20), createdAt: daysAgo(20) } as Pick<
          Lead,
          'assignedTo' | 'deliveredAt' | 'createdAt'
        >,
        { assignedTo: 'marie', deliveredAt: daysAgo(20), createdAt: daysAgo(20) } as Pick<
          Lead,
          'assignedTo' | 'deliveredAt' | 'createdAt'
        >,
        { assignedTo: null, deliveredAt: daysAgo(2), createdAt: daysAgo(2) } as Pick<
          Lead,
          'assignedTo' | 'deliveredAt' | 'createdAt'
        >,
      ],
      [
        {
          type: 'vendeur',
          lastInteractionAt: daysAgo(50),
          createdAt: daysAgo(90),
        } as Pick<Contact, 'type' | 'lastInteractionAt' | 'createdAt'>,
        {
          type: 'acquereur',
          lastInteractionAt: daysAgo(50),
          createdAt: daysAgo(90),
        } as Pick<Contact, 'type' | 'lastInteractionAt' | 'createdAt'>,
      ],
      [
        { mandatStatut: 'mandat_simple', updatedAt: daysAgo(40) } as Pick<
          Bien,
          'mandatStatut' | 'updatedAt'
        >,
        { mandatStatut: 'estimation', updatedAt: daysAgo(5) } as Pick<
          Bien,
          'mandatStatut' | 'updatedAt'
        >,
        { mandatStatut: 'vendu', updatedAt: daysAgo(40) } as Pick<Bien, 'mandatStatut' | 'updatedAt'>,
      ],
      NOW,
    );
    assert.equal(sleeping.unassignedLeads, 1);
    assert.equal(sleeping.silentVendeurs, 1);
    assert.equal(sleeping.staleMandats, 1);
  });
});

describe('buildAgencyOverview', () => {
  it('assemble les trois zones', () => {
    const overview = buildAgencyOverview({
      members: [{ id: 'marie', fullName: 'Marie' }],
      notes: [],
      contacts: [],
      interactions: [],
      biens: [],
      leads: [],
      located: [],
      agencyPostalCodes: ['59000'],
      now: NOW,
    });
    assert.equal(overview.activity.length, 1);
    assert.equal(overview.coverage.length, 1);
    assert.equal(overview.sleeping.unassignedLeads, 0);
  });
});
