import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldDismissOutside } from './pointer-guard';

describe('pointer-guard', () => {
  it('sans racine, on n’intercepte pas', () => {
    assert.equal(shouldDismissOutside(null, null), false);
  });
});
