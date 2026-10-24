import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canSeeVoiceNote } from './visibility';

const director = { id: 'dir-1', role: 'directeur' as const };
const collab = { id: 'col-1', role: 'collaborateur' as const };

describe('canSeeVoiceNote', () => {
  it('laisse une note agence visible à toute l’agence', () => {
    const note = { visibilite: 'agence' as const, createdBy: 'col-1' };
    assert.equal(canSeeVoiceNote(director, note), true);
    assert.equal(canSeeVoiceNote(collab, note), true);
    assert.equal(canSeeVoiceNote({ id: 'col-2', role: 'collaborateur' }, note), true);
  });

  it('laisse une note privée au directeur et à son auteur, pas aux autres', () => {
    const note = { visibilite: 'privee' as const, createdBy: 'col-1' };
    assert.equal(canSeeVoiceNote(director, note), true);
    assert.equal(canSeeVoiceNote(collab, note), true);
    assert.equal(canSeeVoiceNote({ id: 'col-2', role: 'collaborateur' }, note), false);
  });
});
