import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { QrSessionTerrainRow } from '@/types/database';
import { sessionEstVivante } from './session';

function row(over: Partial<QrSessionTerrainRow>): QrSessionTerrainRow {
  return {
    id: 's1',
    agency_id: 'a1',
    agent_id: 'p1',
    token_sha256: 'x'.repeat(64),
    ouverte_le: '2026-09-18T08:00:00.000Z',
    expire_le: '2026-09-18T18:00:00.000Z',
    revoquee_le: null,
    plafond: 30,
    contacts_crees: 0,
    dernier_usage_le: null,
    created_at: '2026-09-18T08:00:00.000Z',
    updated_at: '2026-09-18T08:00:00.000Z',
    ...over,
  };
}

describe('session QR vivante', () => {
  const now = new Date('2026-09-18T12:00:00.000Z');

  it('accepte une session ouverte', () => {
    assert.equal(sessionEstVivante(row({}), now), true);
  });

  it('refuse une session révoquée, expirée ou pleine', () => {
    assert.equal(sessionEstVivante(row({ revoquee_le: now.toISOString() }), now), false);
    assert.equal(sessionEstVivante(row({ expire_le: '2026-09-18T11:00:00.000Z' }), now), false);
    assert.equal(sessionEstVivante(row({ contacts_crees: 30 }), now), false);
  });
});
