import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COULEUR_FAMILLE } from '@/lib/activite/couleurs';
import { COULEUR_COLONNE_DEFAUT, COULEURS_COLONNE, stageColumnTheme } from './stage-theme';

describe('couleurs de colonne', () => {
  it('propose les pastels de l’accueil, pas des primaires', () => {
    assert.ok(COULEURS_COLONNE.length >= 12);
    assert.equal(COULEUR_COLONNE_DEFAUT, COULEUR_FAMILLE.contacts_physiques.pastelFort);
    assert.ok(COULEURS_COLONNE.includes(COULEUR_FAMILLE.contacts_physiques.pastelFort));
    assert.ok(!COULEURS_COLONNE.includes('#E8743C'));
    assert.ok(!COULEURS_COLONNE.includes('#4A90E2'));
  });

  it('prend le pastel comme fond de colonne', () => {
    const theme = stageColumnTheme({
      cle: 'custom',
      type: 'intermediaire',
      accentColor: '#BFD6FF',
    });
    assert.equal(theme.bg, '#BFD6FF');
    assert.notEqual(theme.accent, '#BFD6FF');
  });
});
