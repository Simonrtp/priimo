import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  estBlobRecu,
  estFichierPhoto,
  extensionForBienPhoto,
  isBienPhotoMime,
  mimeDepuisSignature,
  resoudreMimePhoto,
} from './bien-photos';

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

  it('reconnait un Blob duck-typé, pas seulement instanceof', () => {
    const faux = { size: 12, arrayBuffer: async () => new ArrayBuffer(12), slice() { return this; } };
    assert.equal(estBlobRecu(faux), true);
    assert.equal(estBlobRecu({ size: 1 }), false);
    assert.equal(estBlobRecu('x'), false);
  });

  it('filtre vidéos et garde les photos galerie', () => {
    assert.equal(estFichierPhoto({ name: 'salon.jpg', type: 'image/jpeg' }), true);
    assert.equal(estFichierPhoto({ name: 'visite.mp4', type: 'video/mp4' }), false);
    assert.equal(estFichierPhoto({ name: 'visite.MOV', type: '' }), false);
    assert.equal(estFichierPhoto({ name: 'IMG_0001', type: '' }), true);
    assert.equal(estFichierPhoto({ name: 'img', type: 'application/octet-stream' }), true);
  });

  it('lit les signatures jpeg png webp heic video', () => {
    assert.equal(mimeDepuisSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
    assert.equal(
      mimeDepuisSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])),
      'image/png',
    );
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    assert.equal(mimeDepuisSignature(webp), 'image/webp');
    const heic = new Uint8Array(12);
    heic.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    assert.equal(mimeDepuisSignature(heic), 'heic');
    const mp4 = new Uint8Array(12);
    mp4.set([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    assert.equal(mimeDepuisSignature(mp4), 'video');
  });

  it('refuse HEIC et vidéo même si le navigateur ment sur le type', () => {
    const heic = new Uint8Array(12);
    heic.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    const refuse = resoudreMimePhoto('image/jpeg', heic);
    assert.equal('error' in refuse, true);

    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const ok = resoudreMimePhoto('', jpeg);
    assert.deepEqual(ok, { mime: 'image/jpeg' });
  });
});
