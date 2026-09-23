import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prixAuM2, prixAuM2DepuisDossier, surfacePourPrixM2 } from './fourchette';

describe('prix au m²', () => {
  it('est strictement le prix final divisé par la surface retenue', () => {
    assert.equal(prixAuM2(546_000, 74), Math.round(546_000 / 74));
    assert.equal(prixAuM2(546_000, 76), Math.round(546_000 / 76));
    assert.equal(prixAuM2(null, 74), null);
    assert.equal(prixAuM2(546_000, 0), null);
  });

  it('préfère le Carrez à l’habitable', () => {
    const surf = surfacePourPrixM2({ surfaceM2: 76, surfaceCarrez: 74 });
    assert.equal(surf?.libelle, 'Carrez');
    assert.equal(surf?.m2, 74);
    const calcule = prixAuM2DepuisDossier({
      priceValue: 546_000,
      surfaceM2: 76,
      surfaceCarrez: 74,
    });
    assert.equal(calcule?.prixM2, Math.round(546_000 / 74));
    assert.equal(calcule?.libelle, 'Carrez');
  });

  it('ignore une valeur stockée différente du calcul', () => {
    const calcule = prixAuM2DepuisDossier({
      priceValue: 500_000,
      surfaceM2: 50,
      surfaceCarrez: null,
    });
    assert.equal(calcule?.prixM2, 10_000);
    assert.notEqual(calcule?.prixM2, 7176);
  });
});
