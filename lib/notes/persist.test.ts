import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { persistThenExtract } from './persist';
import { emptyReviewPayload } from './build-review';

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

describe('emptyReviewPayload', () => {
  it('donne une fiche vide pour afficher le texte sans attendre l’extraction', () => {
    const payload = emptyReviewPayload('n1', 'voisin au 12');
    assert.equal(payload.voiceNoteId, 'n1');
    assert.equal(payload.transcript, 'voisin au 12');
    assert.equal(payload.personnes.length, 0);
  });
});
