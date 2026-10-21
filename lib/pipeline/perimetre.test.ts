import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { leadsDuPipeline } from './perimetre';

describe('leadsDuPipeline', () => {
  it('garde toutes les cartes : un seul pipeline pour l’agence', () => {
    const leads = [
      { id: 'a', assignedTo: 'agent-1' },
      { id: 'b', assignedTo: 'agent-2' },
      { id: 'c', assignedTo: null },
    ];
    assert.deepEqual(
      leadsDuPipeline(leads).map((l) => l.id),
      ['a', 'b', 'c'],
    );
  });
});
