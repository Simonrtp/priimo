import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { changement, emplacementDe, vueProspection } from './cible';

const de = emplacementDe;

describe('navigation instantanée — changement annoncé', () => {
  it('un autre écran est une page', () => {
    assert.equal(changement(de('/dashboard/contacts'), de('/dashboard/prospection')), 'page');
    assert.equal(changement(de('/dashboard/'), de('/dashboard/contacts')), 'page');
    assert.equal(changement(de('/dashboard/prospection?vue=liste'), de('/dashboard')), 'page');
  });

  it('Carte ↔ Liste ou Pipeline change de vue', () => {
    assert.equal(changement(de('/dashboard/prospection'), de('/dashboard/prospection?vue=liste')), 'vue');
    assert.equal(changement(de('/dashboard/prospection?vue=pipeline'), de('/dashboard/prospection')), 'vue');
  });

  it('Liste ↔ Pipeline, un filtre, une fiche : sur place', () => {
    assert.equal(
      changement(de('/dashboard/prospection?vue=liste'), de('/dashboard/prospection?vue=pipeline')),
      'sur-place',
    );
    assert.equal(changement(de('/dashboard/contacts'), de('/dashboard/contacts?fiche=c1')), 'sur-place');
    assert.equal(changement(de('/dashboard/prospection'), de('/dashboard/prospection?immeuble=x')), 'sur-place');
  });

  it('le même lien ne change rien', () => {
    assert.equal(changement(de('/dashboard/contacts'), de('/dashboard/contacts/')), 'aucun');
  });

  it('les anciennes adresses de la carte et des annonces sont la prospection', () => {
    assert.equal(vueProspection(de('/dashboard/carte?immeuble=x')), 'carte');
    assert.equal(vueProspection(de('/dashboard/annonces')), 'liste');
    assert.equal(vueProspection(de('/dashboard/prospection?lead=l1')), 'liste');
    assert.equal(vueProspection(de('/dashboard/contacts')), null);
    assert.equal(changement(de('/dashboard/carte'), de('/dashboard/prospection?vue=liste')), 'vue');
  });
});
