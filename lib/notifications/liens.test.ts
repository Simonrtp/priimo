import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lienNotification } from './liens';
import { NOTIFICATION_TYPES } from './types';

describe('lienNotification', () => {
  it('donne une route à chaque type', () => {
    for (const type of NOTIFICATION_TYPES) {
      const lien = lienNotification(type, 'id-test');
      assert.ok(lien.startsWith('/dashboard'), type);
    }
  });
});
