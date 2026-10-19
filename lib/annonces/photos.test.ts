import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extrairePhotosPap } from './photos';

const A = 'https://cdn.pap.fr/photos/pap/dc/df/dcdf3f1644679599a3d8fe55021469db/d-p1.jpg';
const B = 'https://cdn.pap.fr/photos/pap/82/54/8254af2954903bd2723a837dfa644c57/8-p1.jpg';

describe('photos PAP', () => {
  it('garde l’ordre de la galerie et retire les doublons', () => {
    const html = `<img src="${A}"><a href="${A}"></a><img src="${B}">`;
    assert.deepEqual(extrairePhotosPap(html), [A, B]);
  });

  it('ignore une image qui n’est pas sur le CDN PAP', () => {
    const html = `<img src="https://evil.example/photos/pap/dc/df/dcdf3f1644679599a3d8fe55021469db/d-p1.jpg"><img src="${A}">`;
    assert.deepEqual(extrairePhotosPap(html), [A]);
  });
});
