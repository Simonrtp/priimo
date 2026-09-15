import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseProspectionVue,
  prospectionHref,
  resoudreProspectionVue,
} from './vue';

describe('parseProspectionVue', () => {
  it('ouvre la carte par défaut', () => {
    assert.equal(parseProspectionVue(null), 'carte');
    assert.equal(parseProspectionVue(undefined), 'carte');
    assert.equal(parseProspectionVue('autre'), 'carte');
  });

  it('reconnaît liste et pipeline', () => {
    assert.equal(parseProspectionVue('liste'), 'liste');
    assert.equal(parseProspectionVue('pipeline'), 'pipeline');
  });
});

describe('resoudreProspectionVue', () => {
  it('reste sur la carte sans paramètre', () => {
    assert.equal(resoudreProspectionVue({}), 'carte');
  });

  it('ouvre la liste pour un lead ou un filtre', () => {
    assert.equal(resoudreProspectionVue({ lead: 'abc' }), 'liste');
    assert.equal(resoudreProspectionVue({ filtre: 'sans-position' }), 'liste');
    assert.equal(resoudreProspectionVue({ fraicheur: 'a-revoir' }), 'liste');
  });

  it('force la liste sur les filtres de lot', () => {
    assert.equal(resoudreProspectionVue({ filtre: 'non-pris', vue: 'carte' }), 'liste');
  });

  it('honore une vue explicite', () => {
    assert.equal(resoudreProspectionVue({ vue: 'pipeline' }), 'pipeline');
    assert.equal(resoudreProspectionVue({ vue: 'liste', lead: 'abc' }), 'liste');
  });
});

describe('prospectionHref', () => {
  it('omet vue=carte : c’est le défaut', () => {
    assert.equal(prospectionHref(new URLSearchParams('vue=liste'), 'carte'), '/dashboard/prospection');
  });

  it('écrit vue=liste', () => {
    assert.equal(
      prospectionHref(new URLSearchParams(), 'liste'),
      '/dashboard/prospection?vue=liste',
    );
  });
});
