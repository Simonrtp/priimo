import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ORANGE_LEAD, ecartTeinte } from '@/lib/activite/couleurs';
import {
  COULEURS_ZONE,
  couleurZoneAvecOpacite,
  couleurZoneLibre,
  estCouleurZone,
} from './palette';

describe('palette des zones — règles non négociables', () => {
  it('compte huit teintes, toutes distinctes', () => {
    assert.equal(COULEURS_ZONE.length, 8);
    assert.equal(new Set(COULEURS_ZONE).size, 8);
  });

  it('n’approche jamais l’orange lead', () => {
    // Un contour de zone ne doit pas pouvoir se confondre avec un point de lead.
    for (const couleur of COULEURS_ZONE) {
      assert.notEqual(couleur.toUpperCase(), ORANGE_LEAD.toUpperCase());
      const ecart = ecartTeinte(couleur, ORANGE_LEAD);
      assert.ok(ecart >= 25, `${couleur} : ${ecart.toFixed(1)}° de l’orange lead`);
    }
  });

  it('écarte les huit teintes deux à deux', () => {
    for (let i = 0; i < COULEURS_ZONE.length; i += 1) {
      for (let j = i + 1; j < COULEURS_ZONE.length; j += 1) {
        const ecart = ecartTeinte(COULEURS_ZONE[i]!, COULEURS_ZONE[j]!);
        assert.ok(
          ecart >= 24,
          `${COULEURS_ZONE[i]} et ${COULEURS_ZONE[j]} : ${ecart.toFixed(1)}° seulement`,
        );
      }
    }
  });
});

describe('attribution d’une couleur', () => {
  it('donne la première teinte libre', () => {
    assert.equal(couleurZoneLibre([]), COULEURS_ZONE[0]);
    assert.equal(couleurZoneLibre([COULEURS_ZONE[0]!]), COULEURS_ZONE[1]);
  });

  it('ignore la casse des teintes déjà prises', () => {
    assert.equal(couleurZoneLibre([COULEURS_ZONE[0]!.toLowerCase()]), COULEURS_ZONE[1]);
  });

  it('recycle au-delà de huit zones plutôt que de rendre null', () => {
    const toutes = [...COULEURS_ZONE];
    assert.ok(estCouleurZone(couleurZoneLibre(toutes)));
  });
});

describe('couleur en rgba pour les couches carte', () => {
  it('convertit un hex en rgba avec l’opacité demandée', () => {
    assert.equal(couleurZoneAvecOpacite('#4C7A9E', 0.12), 'rgba(76,122,158,0.12)');
  });

  it('laisse passer une valeur qu’elle ne sait pas lire', () => {
    assert.equal(couleurZoneAvecOpacite('bleu', 0.12), 'bleu');
  });
});
