import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  levenshtein,
  nameTokens,
  namePrefixPatterns,
  nomCorrespondApprox,
  normalizeNom,
  scoreNom,
  tokenMatches,
} from './nom-match';

describe('normalizeNom', () => {
  it('retire accents et casse', () => {
    assert.equal(normalizeNom('Cécile ROPIOT'), 'cecile ropiot');
  });

  it('traite traits d’union et apostrophes comme des espaces', () => {
    assert.equal(normalizeNom("Jean-Luc D'Arc"), 'jean luc d arc');
    assert.equal(normalizeNom('Marie-Ange O’Neil'), 'marie ange o neil');
  });
});

describe('nameTokens', () => {
  it('écarte les mots-outils et les tokens trop courts', () => {
    assert.deepEqual(nameTokens('le dossier de Cécile Ropiot'), ['cecile', 'ropiot']);
  });

  it('déduplique', () => {
    assert.deepEqual(nameTokens('Ropiot Ropiot'), ['ropiot']);
  });
});

describe('levenshtein', () => {
  it('mesure les distances usuelles', () => {
    assert.equal(levenshtein('ropiot', 'ropioty'), 1);
    assert.equal(levenshtein('ropiot', 'ropiot'), 0);
    assert.equal(levenshtein('ropiot', 'rapiote'), 2);
    assert.equal(levenshtein('', 'abc'), 3);
  });

  it('abandonne au-delà du plafond', () => {
    assert.ok(levenshtein('ropiot', 'martin', 2) > 2);
  });
});

describe('tokenMatches', () => {
  it('tolère une faute sur un token long', () => {
    assert.equal(tokenMatches('ropioty', 'ropiot'), true);
    assert.equal(tokenMatches('ropiott', 'ropiot'), true);
  });

  it('exige l’exactitude sous cinq caractères', () => {
    assert.equal(tokenMatches('luc', 'lac'), false);
    assert.equal(tokenMatches('luc', 'luc'), true);
  });

  it('refuse deux noms sans rapport', () => {
    assert.equal(tokenMatches('ropiot', 'martin'), false);
  });
});

describe('scoreNom', () => {
  it('retrouve un nom mal orthographié', () => {
    const s = scoreNom('Cécile ROPIOTY', 'Cécile Ropiot', 'Cécile', 'Ropiot');
    assert.ok(s.score > 0);
    assert.equal(s.complet, true);
    assert.equal(s.approximatif, true);
  });

  it('ignore l’ordre des tokens', () => {
    const a = scoreNom('Cécile Ropiot', 'Cécile Ropiot');
    const b = scoreNom('Ropiot Cécile', 'Cécile Ropiot');
    assert.equal(a.score, b.score);
    assert.equal(a.complet, b.complet);
  });

  it('fait remonter la fiche sur un seul token distinctif', () => {
    assert.equal(nomCorrespondApprox('Ropiot', 'Cécile Ropiot'), true);
    assert.equal(nomCorrespondApprox('Ropiot', 'Cécile Ropiot-Martin'), true);
  });

  it('classe l’exact avant l’approché', () => {
    const exact = scoreNom('Ropiot', 'Cécile Ropiot');
    const approche = scoreNom('Ropioty', 'Cécile Ropiot');
    assert.ok(exact.score > approche.score);
  });

  it('classe un nom complet avant un nom partiel', () => {
    const complet = scoreNom('Cécile Ropiot', 'Cécile Ropiot');
    const partiel = scoreNom('Cécile Ropiot', 'Cécile Durand');
    assert.ok(complet.score > partiel.score);
    assert.equal(partiel.complet, false);
  });

  it('ne correspond pas sans aucun token commun', () => {
    assert.equal(scoreNom('Ropiot', 'Jean Martin').score, 0);
    assert.equal(scoreNom('', 'Cécile Ropiot').score, 0);
    assert.equal(scoreNom('Ropiot', '').score, 0);
  });

  it('ne se laisse pas piéger par un mot-outil', () => {
    assert.equal(scoreNom('le contact', 'Cécile Ropiot').score, 0);
  });
});

describe('namePrefixPatterns', () => {
  it('rend des préfixes sans accent pour ratisser en base', () => {
    assert.deepEqual(namePrefixPatterns('Cécile ROPIOTY'), ['ceci', 'ropi']);
  });

  it('écarte les fragments trop courts', () => {
    assert.deepEqual(namePrefixPatterns('Li Wu'), []);
  });
});
