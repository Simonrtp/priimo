import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CarteBalayage } from './portails';
import { aVerifierPourRetrait, continuerSeLoger, modeSeLoger, nouvelleLigne, nuitDe, pagesCompletesSeLoger, suivreCarte } from './regles';

const carte = (o: Partial<CarteBalayage> = {}): CarteBalayage => ({
  portail: 'pap',
  idPortail: '465801644',
  url: 'https://www.pap.fr/annonces/appartement-paris-11e-r465801644',
  codePostal: '75011',
  prix: 415000,
  surface: 37,
  pieces: 2,
  dpe: 'C',
  typeBien: 'appartement',
  creeeLe: null,
  ...o,
});

describe('modeSeLoger', () => {
  const maintenant = new Date('2026-10-26T00:30:00Z');
  it('complet la première fois, puis une fois par semaine', () => {
    assert.deepEqual(modeSeLoger(null, null, maintenant), { mode: 'complet' });
    assert.deepEqual(modeSeLoger('2026-10-19T00:30:00Z', '2026-10-25T00:30:00Z', maintenant), { mode: 'complet' });
  });
  it('sinon les annonces créées depuis le passage d’avant, moins un jour', () => {
    assert.deepEqual(modeSeLoger('2026-10-22T00:30:00Z', '2026-10-25T00:30:00Z', maintenant), { mode: 'recent', depuis: '2026-10-24T00:30:00.000Z' });
  });
});

describe('continuerSeLoger', () => {
  const depuis = '2026-10-24T00:00:00Z';
  it('continue tant qu’une annonce récente apparaît', () => {
    assert.equal(continuerSeLoger({ datesCreation: ['2026-10-23T10:00:00Z', '2026-10-24T09:00:00Z'], depuis, page: 1, total: 1374 }), true);
  });
  it('une vieille annonce mise en avant ne relance rien', () => {
    assert.equal(continuerSeLoger({ datesCreation: ['2026-04-27T07:05:00Z', '2026-10-23T08:00:00Z'], depuis, page: 1, total: 1374 }), false);
  });
  it('s’arrête à la dernière page et au plafond du soir', () => {
    assert.equal(continuerSeLoger({ datesCreation: ['2026-10-25T00:00:00Z'], depuis, page: 2, total: 55 }), false);
    assert.equal(continuerSeLoger({ datesCreation: ['2026-10-25T00:00:00Z'], depuis, page: 10, total: 1374 }), false);
  });
});

describe('pagesCompletesSeLoger', () => {
  it('toutes les pages du total, plafonnées', () => {
    assert.equal(pagesCompletesSeLoger(1374), 46);
    assert.equal(pagesCompletesSeLoger(null), 1);
    assert.equal(pagesCompletesSeLoger(99_999), 60);
  });
});

describe('suivreCarte', () => {
  const vue = '2026-10-26T01:00:00.000Z';
  it('une baisse de prix : nouveau prix et événement chiffré', () => {
    const r = suivreCarte({ id: 'a', statut: 'active', prix: 420000, retireeLe: null }, carte({ prix: 399000 }), vue);
    assert.deepEqual(r.colonnes, { derniere_vue_le: vue, prix: 399000 });
    assert.deepEqual(r.evenements, [{ type: 'baisse_prix', avant: { prix: 420000 }, apres: { prix: 399000, variation_pct: -5 } }]);
  });
  it('revue sans changement : seulement vue ; un prix absent n’efface rien', () => {
    assert.deepEqual(suivreCarte({ id: 'a', statut: 'active', prix: 415000, retireeLe: null }, carte(), vue), { colonnes: { derniere_vue_le: vue }, evenements: [] });
    assert.deepEqual(suivreCarte({ id: 'a', statut: 'active', prix: 415000, retireeLe: null }, carte({ prix: null }), vue).colonnes, { derniere_vue_le: vue });
  });
  it('retirée puis revue : remise en ligne', () => {
    const r = suivreCarte({ id: 'a', statut: 'retiree', prix: 415000, retireeLe: '2026-10-20T01:00:00Z' }, carte(), vue);
    assert.equal(r.colonnes.statut, 'active');
    assert.equal(r.colonnes.retiree_le, null);
    assert.equal(r.evenements[0]?.type, 'remise_en_ligne');
  });
});

describe('nouvelleLigne', () => {
  it('une annonce de particulier, en attente de sa fiche', () => {
    const l = nouvelleLigne(carte(), '75011', '2026-10-26T01:00:00.000Z');
    assert.equal(l.origine, 'veille');
    assert.equal(l.type_vendeur, 'particulier');
    assert.equal(l.confiance, 'incertaine');
    assert.equal(l.prix_initial, 415000);
    assert.equal(l.code_postal, '75011');
  });
});

describe('aVerifierPourRetrait', () => {
  it('seules les actives non revues depuis 20 h', () => {
    const debut = '2026-10-26T00:30:00Z';
    const lignes = [
      { id: 'revue', statut: 'active', derniereVueLe: '2026-10-26T00:40:00Z' },
      { id: 'hier', statut: 'active', derniereVueLe: '2026-10-25T00:40:00Z' },
      { id: 'deja', statut: 'retiree', derniereVueLe: '2026-10-20T00:40:00Z' },
    ];
    assert.deepEqual(aVerifierPourRetrait(lignes, debut).map((l) => l.id), ['hier']);
  });
});

describe('nuitDe', () => {
  it('la date à Paris', () => {
    assert.equal(nuitDe(new Date('2026-10-25T23:30:00Z')), '2026-10-26');
    assert.equal(nuitDe(new Date('2026-10-26T00:30:00Z')), '2026-10-26');
  });
});
