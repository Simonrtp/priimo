import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldLockVoice, voiceLockProgress } from './gesture-lock.js';

describe('gesture-lock', () => {
  it('ignore le swipe horizontal', () => {
    assert.equal(shouldLockVoice(80, 120), false);
    assert.equal(shouldLockVoice(80, 40), true);
  });

  it('calcule la progression verticale', () => {
    assert.equal(voiceLockProgress(36), 0.5);
    assert.equal(voiceLockProgress(72), 1);
  });
});
