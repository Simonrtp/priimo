import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  abregerDenomination,
  AgregatLots,
  decrireNiveaux,
  etageDuNiveau,
  parcelleDuLocal,
  seulementSousSol,
  versProprietaires,
  type LigneLocal,
} from './proprietaires-lots';

const ligne = (partiel: Partial<LigneLocal>): LigneLocal => ({
  departement: '75',
  commune: '101',
  prefixe: '',
  section: 'AY',
  plan: '0102',
  niveau: '00',
  droit: 'P - Propriétaire',
  siren: '333296846',
  groupe: '0 - Personnes morales non remarquables ',
  forme: 'SCI',
  denomination: 'R F D',
  ...partiel,
});

describe('parcelleDuLocal', () => {
  it('reconstitue la référence à 14 caractères', () => {
    assert.equal(parcelleDuLocal(ligne({})), '75101000AY0102');
    assert.equal(parcelleDuLocal(ligne({ departement: '74', commune: '10', section: 'B', plan: '240' })), '740100000B0240');
  });

  it('rejette une référence incomplète', () => {
    assert.equal(parcelleDuLocal(ligne({ section: '' , plan: '' })), null);
  });
});

describe('AgregatLots', () => {
  it('compte les lots et les étages d’un même propriétaire sur une parcelle', () => {
    const a = new AgregatLots();
    a.ajouter(ligne({ niveau: '00' }));
    a.ajouter(ligne({ niveau: '03' }));
    a.ajouter(ligne({ niveau: '03' }));
    a.ajouter(ligne({ siren: '314007527', forme: 'SAS', denomination: 'HOTEL SAINT HONORE', niveau: '01' }));
    const r = a.resultat();
    assert.equal(r.length, 2);
    const sci = r.find((x) => x.forme === 'SCI')!;
    assert.equal(sci.nb_lots, 3);
    assert.deepEqual(sci.niveaux, [0, 3]);
    assert.equal(sci.droit, 'P');
    assert.equal(sci.groupe, 0);
  });

  it('sépare propriétaire et usufruitier', () => {
    const a = new AgregatLots();
    a.ajouter(ligne({ droit: 'P - Propriétaire' }));
    a.ajouter(ligne({ droit: 'U - Usufruitier' }));
    assert.equal(a.taille, 2);
  });
});

describe('etageDuNiveau', () => {
  it('range les sous-sols DGFiP (81, 82…) sous zéro et écarte les codes sans étage', () => {
    assert.equal(etageDuNiveau(0), 0);
    assert.equal(etageDuNiveau(7), 7);
    assert.equal(etageDuNiveau(81), -1);
    assert.equal(etageDuNiveau(83), -3);
    assert.equal(etageDuNiveau(-1), -1);
    assert.equal(etageDuNiveau(80), null);
    assert.equal(etageDuNiveau(99), null);
  });

  it('s’applique dès l’import', () => {
    const a = new AgregatLots();
    a.ajouter(ligne({ niveau: '81' }));
    a.ajouter(ligne({ niveau: '02' }));
    a.ajouter(ligne({ niveau: '99' }));
    assert.deepEqual(a.resultat()[0]!.niveaux, [-1, 2]);
    assert.equal(a.resultat()[0]!.nb_lots, 3);
  });
});

describe('decrireNiveaux', () => {
  it('dit les étages comme un agent', () => {
    assert.equal(decrireNiveaux([0]), 'rez-de-chaussée');
    assert.equal(decrireNiveaux([3]), '3e étage');
    assert.equal(decrireNiveaux([0, 3]), 'RDC et 3e étage');
    assert.equal(decrireNiveaux([0, 2, 4]), 'RDC, 2e et 4e étages');
    assert.equal(decrireNiveaux([0, 1, 2, 3, 4, 5, 6, 7]), 'du RDC au 7e');
    assert.equal(decrireNiveaux([]), null);
  });

  it('dit « sous-sol », jamais « 81e étage »', () => {
    assert.equal(decrireNiveaux([-1]), 'sous-sol');
    assert.equal(decrireNiveaux([81, 82]), 'sous-sol');
    assert.equal(decrireNiveaux([-1, 3]), 'sous-sol et 3e étage');
    assert.equal(decrireNiveaux([-2, -1, 0, 2, 4]), 'sous-sol, RDC, 2e et 4e étages');
    assert.equal(decrireNiveaux([-1, 0, 1, 2, 3, 4, 5]), 'du sous-sol au 5e');
    assert.equal(decrireNiveaux([99]), null);
  });

  it('repère les lots tous en sous-sol', () => {
    assert.equal(seulementSousSol([-1, -2]), true);
    assert.equal(seulementSousSol([81]), true);
    assert.equal(seulementSousSol([-1, 0]), false);
    assert.equal(seulementSousSol([]), false);
  });
});

describe('abregerDenomination', () => {
  it('nomme une SCI comme on la nomme', () => {
    assert.equal(abregerDenomination('SOCIETE CIVILE IMMOBILIERE DU PORT'), 'SCI DU PORT');
    assert.equal(abregerDenomination('Société civile immobilière Les Lilas'), 'SCI Les Lilas');
    assert.equal(abregerDenomination('SCI CYJO'), 'SCI CYJO');
  });
});

describe('versProprietaires', () => {
  it('fusionne propriété et usufruit, classe par nature puis par nombre de lots', () => {
    const p = versProprietaires([
      { parcelle_id: 'X', siren: '1', denomination: 'SCI PETITE', forme: 'SCI', groupe: 0, droit: 'P', nb_lots: 1, niveaux: [3] },
      { parcelle_id: 'X', siren: '2', denomination: 'SCI GRANDE', forme: 'SCI', groupe: 0, droit: 'P', nb_lots: 6, niveaux: [0, 1] },
      { parcelle_id: 'X', siren: '2', denomination: 'SCI GRANDE', forme: 'SCI', groupe: 0, droit: 'U', nb_lots: 2, niveaux: [2] },
      { parcelle_id: 'X', siren: '3', denomination: 'COMMUNE D ANNECY', forme: 'COM', groupe: 4, droit: 'P', nb_lots: 1, niveaux: [0] },
      { parcelle_id: 'X', siren: '4', denomination: 'SYND COPR', forme: null, groupe: 7, droit: 'P', nb_lots: 1, niveaux: [] },
    ]);
    assert.deepEqual(
      p.map((x) => [x.nom, x.genre, x.nbLots]),
      [
        ['COMMUNE D ANNECY', 'public', 1],
        ['SCI GRANDE', 'sci', 8],
        ['SCI PETITE', 'sci', 1],
        ['SYND COPR', 'copropriete', 1],
      ],
    );
    assert.deepEqual(p[1]!.niveaux, [0, 1, 2]);
    assert.equal(p[1]!.droit, 'P');
  });
});
