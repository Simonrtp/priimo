import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toDisplayCompanyName } from './lead-person-display';

describe('toDisplayCompanyName', () => {
  it('garde les sigles juridiques en capitales', () => {
    assert.equal(toDisplayCompanyName('SCI LES LILAS'), 'SCI les Lilas');
    assert.equal(toDisplayCompanyName('sarl martin et fils'), 'SARL Martin et Fils');
  });

  it('met les mots de liaison en minuscules, sauf en tête', () => {
    assert.equal(toDisplayCompanyName('BOULANGERIE DES LILAS'), 'Boulangerie des Lilas');
    assert.equal(toDisplayCompanyName('LES ATELIERS DU MARAIS'), 'Les Ateliers du Marais');
  });

  it('respecte les élisions, les tirets et les chiffres', () => {
    assert.equal(toDisplayCompanyName("CABINET D'ARTOIS"), 'Cabinet d’Artois');
    assert.equal(toDisplayCompanyName('SAINT-GERMAIN IMMO 75'), 'Saint-Germain Immo 75');
  });
});
