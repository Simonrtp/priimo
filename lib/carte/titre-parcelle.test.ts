import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { titreParcelle } from './parcelle';

describe('titreParcelle', () => {
  const fiche = {
    adresse: '29 Rue Alphonse Penaud',
    reference: '75020AB0123',
    adresses: [
      { banId: 'ban-29', libelle: '29 Rue Alphonse Penaud' },
      { banId: 'ban-27', libelle: '27 Rue Alphonse Penaud' },
    ],
  };

  it('préfère le libellé BAN cherché quand le banId match', () => {
    assert.equal(
      titreParcelle(fiche, { banId: 'ban-27', libelle: '27 Rue Alphonse Penaud 75020 Paris' }),
      '27 Rue Alphonse Penaud',
    );
  });

  it('reprend le libellé cherché si le banId n’est pas dans la fiche', () => {
    assert.equal(
      titreParcelle(fiche, { banId: 'ban-inconnu', libelle: '27 Rue Alphonse Penaud' }),
      '27 Rue Alphonse Penaud',
    );
  });

  it('garde l’adresse de la fiche sans recherche', () => {
    assert.equal(titreParcelle(fiche, null), '29 Rue Alphonse Penaud');
  });
});
