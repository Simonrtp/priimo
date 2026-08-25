import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { persistThenExtract } from './persist';

describe('persistThenExtract', () => {
  it('enregistre la note même si l’extraction échoue', async () => {
    const result = await persistThenExtract(
      async () => ({ id: 'note-1' }),
      async () => {
        throw new Error('modele down');
      },
    );
    assert.equal(result.note.id, 'note-1');
    assert.equal(result.extractFailed, true);
  });

  it('signale un extract réussi', async () => {
    const result = await persistThenExtract(
      async () => ({ id: 'note-2' }),
      async () => undefined,
    );
    assert.equal(result.extractFailed, false);
  });
});
