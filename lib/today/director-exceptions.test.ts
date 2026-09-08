import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDirectorExceptions } from './director-exceptions';

describe('buildDirectorExceptions', () => {
  it('liste les exceptions par personne, pas une pile de tâches', () => {
    const rows = buildDirectorExceptions({
      members: [
        { id: 'a', fullName: 'Alice' },
        { id: 'b', fullName: 'Bruno' },
      ],
      leads: [
        { assignedTo: 'a', stageId: null },
        { assignedTo: 'a', stageId: null },
        { assignedTo: 'b', stageId: 'pris' },
      ],
      notes: [{ createdBy: 'b', statut: 'brute' }],
      activityVolumeByMemberId: { a: 4, b: 0 },
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.fullName, 'Alice');
    assert.equal(rows[0]?.items[0]?.count, 2);
    const bruno = rows.find((r) => r.memberId === 'b');
    assert.ok(bruno?.items.some((i) => i.label.includes('brute')));
    assert.ok(bruno?.items.some((i) => i.label.includes('activité')));
    assert.ok(rows[0]?.items[0]?.href?.includes('membre=a'));
    assert.equal(bruno?.items.find((i) => i.kind === 'inactivite')?.href, null);
  });
});
