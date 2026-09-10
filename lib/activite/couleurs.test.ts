import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COULEUR_FAMILLE,
  ORANGE_LEAD,
  contraste,
  ecartTeinte,
  estViolet,
  luminanceRelative,
  teinteDegres,
} from './couleurs';
import { FAMILLES_ACTIVITE } from './types';

const FAMILLES = [...FAMILLES_ACTIVITE];

describe('couleurs de famille — règles non négociables', () => {
  it('couvre les cinq familles, et seulement elles', () => {
    assert.deepEqual(Object.keys(COULEUR_FAMILLE).sort(), FAMILLES.slice().sort());
  });

  it('n’utilise aucun violet — règle FIELD', () => {
    for (const f of FAMILLES) {
      const { teinte, pastille } = COULEUR_FAMILLE[f];
      assert.equal(estViolet(teinte), false, `${f} : teinte violette ${teinte}`);
      assert.equal(estViolet(pastille), false, `${f} : pastille violette ${pastille}`);
    }
  });

  it('laisse l’orange lead tranquille', () => {
    for (const f of FAMILLES) {
      const teinte = COULEUR_FAMILLE[f].teinte;
      assert.notEqual(teinte.toUpperCase(), ORANGE_LEAD.toUpperCase());
      // Une famille dans un rayon de 15° autour de l'orange produit le
      // banaliserait : c'est ce qui condamnait le terracotta de la proposition.
      assert.ok(
        ecartTeinte(teinte, ORANGE_LEAD) > 15,
        `${f} (${teinte}) est à ${ecartTeinte(teinte, ORANGE_LEAD).toFixed(0)}° de l’orange lead`,
      );
    }
  });
});

describe('couleurs de famille — lisibilité à 32 px', () => {
  it('sépare les teintes deux à deux', () => {
    // 20° : en dessous, deux pastilles de 32 px se confondent au coup d'œil.
    for (let i = 0; i < FAMILLES.length; i += 1) {
      for (let j = i + 1; j < FAMILLES.length; j += 1) {
        const a = COULEUR_FAMILLE[FAMILLES[i]!].teinte;
        const b = COULEUR_FAMILLE[FAMILLES[j]!].teinte;
        const ecart = ecartTeinte(a, b);
        assert.ok(
          ecart >= 20,
          `${FAMILLES[i]} (${a}) et ${FAMILLES[j]} (${b}) : ${ecart.toFixed(0)}° d’écart`,
        );
      }
    }
  });

  it('garde l’icône lisible sur sa pastille', () => {
    // 3:1 — seuil WCAG pour un élément graphique non textuel.
    for (const f of FAMILLES) {
      const { teinte, pastille } = COULEUR_FAMILLE[f];
      const ratio = contraste(teinte, pastille);
      assert.ok(ratio >= 3, `${f} : contraste icône/pastille ${ratio.toFixed(2)}`);
    }
  });

  it('garde la teinte lisible sur le voile de la carte', () => {
    for (const f of FAMILLES) {
      const { teinte, voile } = COULEUR_FAMILLE[f];
      const ratio = contraste(teinte, voile);
      assert.ok(ratio >= 3, `${f} : contraste teinte/voile ${ratio.toFixed(2)}`);
    }
  });

  it('empile les quatre paliers du plus foncé au plus clair', () => {
    // Sinon la piste de la barre se dissout dans la carte, ou le carré de
    // l'icône dans la piste, et plus rien ne se détache.
    for (const f of FAMILLES) {
      const { teinte, pastelFort, pastille, voile } = COULEUR_FAMILLE[f];
      const paliers = [teinte, pastelFort, pastille, voile];
      const luminances = paliers.map(luminanceRelative);
      for (let i = 1; i < luminances.length; i += 1) {
        assert.ok(
          luminances[i]! > luminances[i - 1]!,
          `${f} : ${paliers[i]} pas plus clair que ${paliers[i - 1]}`,
        );
      }
    }
  });

  it('garde le texte fort lisible sur chaque pastille', () => {
    for (const f of FAMILLES) {
      const ratio = contraste('#1E1B4B', COULEUR_FAMILLE[f].pastille);
      assert.ok(ratio >= 4.5, `${f} : contraste texte/pastille ${ratio.toFixed(2)}`);
    }
  });

  it('garde le texte lisible sur le voile de carte', () => {
    for (const f of FAMILLES) {
      const ratio = contraste('#1E1B4B', COULEUR_FAMILLE[f].voile);
      assert.ok(ratio >= 4.5, `${f} : contraste texte/voile ${ratio.toFixed(2)}`);
    }
  });

  it('garde le libellé du bouton lisible sur le pastel appuyé', () => {
    for (const f of FAMILLES) {
      const ratio = contraste('#1E1B4B', COULEUR_FAMILLE[f].pastelFort);
      assert.ok(ratio >= 4.5, `${f} : contraste texte/pastel ${ratio.toFixed(2)}`);
    }
  });
});

describe('couleurs de famille — secteurs', () => {
  it('range les cinq teintes sur des secteurs distincts du cercle', () => {
    const teintes = FAMILLES.map((f) => Math.round(teinteDegres(COULEUR_FAMILLE[f].teinte)));
    assert.equal(new Set(teintes).size, FAMILLES.length);
  });
});
