import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COULEUR_FAMILLE,
  ORANGE_LEAD,
  contraste,
  ecartTeinte,
  estViolet,
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

  it('garde la teinte lisible sur la carte blanche', () => {
    for (const f of FAMILLES) {
      const ratio = contraste(COULEUR_FAMILLE[f].teinte, '#FFFFFF');
      assert.ok(ratio >= 3, `${f} : contraste teinte/blanc ${ratio.toFixed(2)}`);
    }
  });

  it('garde le texte fort lisible sur chaque pastille', () => {
    for (const f of FAMILLES) {
      const ratio = contraste('#1E1B4B', COULEUR_FAMILLE[f].pastille);
      assert.ok(ratio >= 4.5, `${f} : contraste texte/pastille ${ratio.toFixed(2)}`);
    }
  });
});

describe('la correction apportée à la proposition de départ', () => {
  it('écarte le couple terracotta / rouge brique qui était indiscernable', () => {
    // Les deux teintes proposées à l'origine, conservées ici comme garde-fou.
    assert.ok(
      ecartTeinte('#B4552F', '#A03A32') < 20,
      'le couple d’origine devrait bien être sous le seuil de séparation',
    );
    // Et le remplaçant s'en éloigne franchement.
    assert.ok(ecartTeinte(COULEUR_FAMILLE.estimations.teinte, '#A03A32') > 100);
  });

  it('donne aux estimations la teinte de l’étape pipeline correspondante', () => {
    // Même valeur que defaultAccentColor('estimation') dans lib/queries/lead-stages.ts
    // et que l'accent de stage-theme.ts. Si l'une bouge, les trois bougent.
    assert.equal(COULEUR_FAMILLE.estimations.teinte, '#1F8294');
  });

  it('remonte l’ocre au-dessus du seuil de contraste qu’il ratait', () => {
    // #C08A2E ne donnait que 2,48:1 sur la pastille crème.
    assert.ok(contraste('#C08A2E', '#F5E7C9') < 3);
    assert.ok(contraste(COULEUR_FAMILLE.immeubles_prospectes.teinte, '#F5E7C9') >= 3);
  });

  it('documente le couple le plus serré : bleu canard et bleu ardoise', () => {
    const ecart = ecartTeinte(
      COULEUR_FAMILLE.estimations.teinte,
      COULEUR_FAMILLE.contacts_physiques.teinte,
    );
    assert.ok(ecart >= 20 && ecart < 45, `écart attendu serré mais suffisant, obtenu ${ecart}`);
    // Ils se séparent surtout par la clarté : l'un est nettement plus lumineux.
    const contrasteEntreEux = contraste(
      COULEUR_FAMILLE.estimations.teinte,
      COULEUR_FAMILLE.contacts_physiques.teinte,
    );
    assert.ok(contrasteEntreEux >= 1.3, `séparation par la clarté trop faible : ${contrasteEntreEux}`);
  });

  it('range les cinq teintes sur des secteurs distincts du cercle', () => {
    const teintes = FAMILLES.map((f) => Math.round(teinteDegres(COULEUR_FAMILLE[f].teinte)));
    assert.equal(new Set(teintes).size, FAMILLES.length);
  });
});
