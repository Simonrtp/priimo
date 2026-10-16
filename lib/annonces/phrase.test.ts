import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { phraseMouvements, titreNouvelles } from './phrase';

describe('phrase des annonces', () => {
  it('se tait sans mouvement', () => {
    assert.equal(phraseMouvements(0, 0), null);
  });

  it('accorde la ligne du brief', () => {
    assert.equal(phraseMouvements(2, 1), '2 baisses de prix et 1 annonce retirée dans mon secteur');
    assert.equal(phraseMouvements(1, 0), '1 baisse de prix dans mon secteur');
  });

  it('regroupe les nouvelles de particuliers', () => {
    assert.match(titreNouvelles(5), /5 nouvelles annonces de particuliers/);
  });
});
