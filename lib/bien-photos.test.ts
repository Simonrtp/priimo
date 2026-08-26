import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extensionForBienPhoto, isBienPhotoMime } from './bien-photos';

describe('bien photos', () => {
  it('accepte jpeg png webp', () => {
    assert.equal(extensionForBienPhoto('image/jpeg'), 'jpg');
    assert.equal(extensionForBienPhoto('image/png; charset=binary'), 'png');
    assert.equal(extensionForBienPhoto('image/webp'), 'webp');
    assert.equal(isBienPhotoMime('image/jpeg'), true);
  });

  it('refuse le reste', () => {
    assert.equal(extensionForBienPhoto('image/gif'), null);
    assert.equal(extensionForBienPhoto('application/pdf'), null);
    assert.equal(isBienPhotoMime('text/plain'), false);
  });
});
