import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estResidentiel, genreProprietaire, syntheseBdnb, type LigneBdnb } from './bdnb';

describe('genreProprietaire', () => {
  it('reconnaît syndic, bailleur social, public et SCI', () => {
    assert.equal(genreProprietaire('SYND COPR 97 RUE DE CHARONNE'), 'copropriete');
    assert.equal(genreProprietaire('ADOMA'), 'social');
    assert.equal(genreProprietaire('PARIS HABITAT OPH'), 'social');
    assert.equal(genreProprietaire('VILLE DE PARIS'), 'public');
    assert.equal(genreProprietaire('SCI PREMIAN'), 'sci');
    assert.equal(genreProprietaire('EURASIM'), 'societe');
  });
});

describe('syntheseBdnb', () => {
  const grand: LigneBdnb = {
    batiment_groupe_id: 'g1',
    surface_emprise_sol: 1640,
    usage_principal_bdnb_open: 'Résidentiel collectif',
    nb_log: 268,
    nb_log_rnc: 283,
    nb_niveau: 8,
    annee_construction: 1928,
    mat_mur_txt: 'BETON',
    l_denomination_proprietaire: ['SYND COPR 97 RUE DE CHARONNE', 'SCI PREMIAN', 'EURASIM'],
    l_siren: ['039220603', '382615961', '123456789'],
    distance_monument_historique: 54,
    denomination_monument_historique: 'Ancien couvent des Bénédictines du Bon-Secours',
    nb_classe_bilan_dpe_d: 3,
    nb_classe_bilan_dpe_g: 1,
    nb_classe_conso_energie_arrete_2012_f: 2,
    l_cle_interop_adr: ['75111_1888_00097', '75111_1888_00097b'],
    libelle_adr_principale_ban: '97 Rue de Charonne 75011 Paris 11e Arrondissement',
  };
  const petit: LigneBdnb = {
    batiment_groupe_id: 'g2',
    surface_emprise_sol: 7,
    nb_classe_bilan_dpe_d: 1,
    distance_monument_historique: 33,
    denomination_monument_historique: 'palais de la femme',
  };

  it('résume plusieurs bâtiments en un immeuble, le plus grand donnant le ton', () => {
    const b = syntheseBdnb([petit, grand])!;
    assert.equal(b.nbBatiments, 2);
    assert.equal(b.usage, 'Résidentiel collectif');
    assert.equal(b.anneeConstruction, 1928);
    assert.equal(b.logements, 283);
    assert.equal(b.niveaux, 8);
    assert.equal(b.empriseM2, 1647);
    assert.equal(b.dpeRecents, 5);
    assert.equal(b.dpeRecentsFG, 1);
    assert.equal(b.dpeAnciensFG, 2);
    assert.deepEqual(b.monumentHistorique, { nom: 'palais de la femme', distanceM: 33 });
    assert.deepEqual(b.adressesBan, ['75111_1888_00097', '75111_1888_00097b']);
    assert.equal(b.adressePrincipale, '97 Rue de Charonne 75011 Paris 11e Arrondissement');
  });

  it('classe les propriétaires, le syndicat en dernier, avec leur SIREN', () => {
    const b = syntheseBdnb([grand])!;
    assert.deepEqual(
      b.proprietaires.map((p) => [p.nom, p.genre, p.siren]),
      [
        ['SCI PREMIAN', 'sci', '382615961'],
        ['EURASIM', 'societe', '123456789'],
        ['SYND COPR 97 RUE DE CHARONNE', 'copropriete', '039220603'],
      ],
    );
  });

  it('ne retient pas un monument au-delà des abords', () => {
    const b = syntheseBdnb([{ ...grand, distance_monument_historique: 800 }])!;
    assert.equal(b.monumentHistorique, null);
  });

  it('rend null sans bâtiment', () => {
    assert.equal(syntheseBdnb([]), null);
  });
});

describe('estResidentiel', () => {
  it('distingue logement et tertiaire', () => {
    assert.equal(estResidentiel('Résidentiel collectif'), true);
    assert.equal(estResidentiel('Tertiaire'), false);
    assert.equal(estResidentiel(null), false);
  });
});
