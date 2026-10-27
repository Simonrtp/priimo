import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { goutte } from './goutte';

describe('goutte — barre de recherche et micro', () => {
  const g = goutte({ hauteurPilule: 36, rayonCercle: 22, ecart: 38, rayonCoin: 12, rayonCol: 11 });

  it('donne un chemin fermé, sans valeur indéfinie', () => {
    assert.match(g.chemin, /^M0 /);
    assert.match(g.chemin, /Z$/);
    assert.doesNotMatch(g.chemin, /NaN|Infinity/);
  });

  it('pose le cercle au bout de la goutte, centré en hauteur', () => {
    assert.equal(g.largeur, 2 + 38 + 22);
    assert.equal(g.hauteur, 44);
    assert.equal(g.cx, 40);
    assert.equal(g.cy, 22);
  });

  it('creuse un col plus étroit que la pilule', () => {
    assert.ok(g.demiCol > 6 && g.demiCol < 18, `col : ${g.demiCol}`);
  });
});
