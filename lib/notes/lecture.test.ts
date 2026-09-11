import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lienLectureNote } from './lecture';

describe('lienLectureNote', () => {
  it('ouvre la carte sur l’accueil, plus une page Notes', () => {
    assert.equal(lienLectureNote(), '/dashboard?notes=1');
    assert.equal(lienLectureNote(null), '/dashboard?notes=1');
    assert.equal(lienLectureNote('abc-1'), '/dashboard?notes=abc-1');
  });
});
