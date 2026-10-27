import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { goutte } from './goutte';

describe('goutte — barre de recherche et micro', () => {
  const g = goutte({ hauteurPilule: 36, rayonCercle: 24, bout: 26, espace: 3, flou: 7 });

  it('pose le cercle au bout de la goutte, centré en hauteur', () => {
    assert.equal(g.cx, 26 + 3 + 24);
    assert.equal(g.cy, 24);
    assert.equal(g.largeur, g.cx + 24);
    assert.equal(g.hauteur, 48);
  });

  it('aligne le bout de pilule sur la barre et le fait déborder dessus', () => {
    assert.equal(g.bout.h, 36);
    assert.equal(g.bout.y, 24 - 18);
    assert.ok(g.bout.x < 0, 'le bout recouvre la barre');
    assert.equal(g.bout.x + g.bout.w, 26);
  });

  it('garde la zone du filtre plus large que la forme, flou compris', () => {
    assert.ok(g.zone.x < g.bout.x);
    assert.ok(g.zone.y < 0);
    assert.ok(g.zone.x + g.zone.w > g.largeur);
    assert.ok(g.zone.y + g.zone.h > g.hauteur);
  });

  it('le seuil règle le contraste : plus bas, col plus charnu', () => {
    const charnu = goutte({ hauteurPilule: 36, rayonCercle: 24, bout: 26, espace: 3, flou: 7, seuil: 0.4 });
    assert.ok(charnu.contraste.decalage > g.contraste.decalage);
  });
});
