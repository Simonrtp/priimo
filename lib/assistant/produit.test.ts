import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  chercherProduit,
  contexteProduit,
  estQuestionProduit,
  parseProduitMarkdown,
  reponseProduitDirecte,
  sujetsProduit,
} from './produit';
import { routeQuestion } from './router';

const MARKDOWN = `# Titre

## Le bouton Nouveau
Écran: /dashboard
Mots-clés: nouveau, bouton nouveau, créer

Le bouton Nouveau ouvre la création rapide.

## Le score
Mots-clés: score, note

Le score va de 0 à 100.
`;

describe('parseProduitMarkdown', () => {
  const sujets = parseProduitMarkdown(MARKDOWN);

  it('lit titre, écran, mots-clés et corps', () => {
    assert.equal(sujets.length, 2);
    assert.equal(sujets[0]!.titre, 'Le bouton Nouveau');
    assert.equal(sujets[0]!.ecran, '/dashboard');
    assert.ok(sujets[0]!.motsCles.includes('bouton nouveau'));
    assert.ok(sujets[0]!.corps.startsWith('Le bouton Nouveau ouvre'));
  });

  it('accepte un sujet sans écran', () => {
    assert.equal(sujets[1]!.ecran, null);
  });
});

describe('chercherProduit', () => {
  const sujets = parseProduitMarkdown(MARKDOWN);

  it('retrouve le sujet et son écran', () => {
    const r = chercherProduit('À quoi sert le bouton Nouveau ?', sujets);
    assert.equal(r.sujets[0]?.titre, 'Le bouton Nouveau');
    assert.deepEqual(r.ecrans, [{ titre: 'Le bouton Nouveau', href: '/dashboard' }]);
  });

  it('ne rend rien quand aucun sujet ne colle', () => {
    assert.equal(chercherProduit('Le prix du marché à Lyon', sujets).sujets.length, 0);
  });

  it('répond sans modèle quand un seul sujet ressort', () => {
    const r = chercherProduit('bouton nouveau', sujets);
    assert.equal(reponseProduitDirecte(r), 'Le bouton Nouveau ouvre la création rapide.');
  });

  it('passe le contexte au modèle quand deux sujets se disputent', () => {
    const r = chercherProduit('le score du bouton nouveau', sujets);
    assert.equal(r.sujets.length, 2);
    assert.equal(reponseProduitDirecte(r), null);
    assert.ok(contexteProduit(r).includes('Le score va de 0 à 100.'));
  });
});

describe('estQuestionProduit', () => {
  const sujets = parseProduitMarkdown(MARKDOWN);

  it('reconnaît une question sur le fonctionnement', () => {
    assert.equal(estQuestionProduit('À quoi sert le bouton Nouveau ?', sujets), true);
    assert.equal(estQuestionProduit('Ça veut dire quoi le score ?', sujets), true);
    assert.equal(estQuestionProduit('Comment créer un contact ?', sujets), true);
  });

  it('refuse une question sans sujet documenté', () => {
    assert.equal(estQuestionProduit('À quoi sert la lune ?', sujets), false);
  });

  it('refuse une question sur les données', () => {
    assert.equal(estQuestionProduit("Qu'est-ce qu'on sait sur le 12 rue Vitruve ?", sujets), false);
  });
});

describe('routage des questions produit', () => {
  it("classe « À quoi sert le bouton Nouveau » en produit, pas en activité", () => {
    const r = routeQuestion('À quoi sert le bouton Nouveau ?');
    assert.equal(r?.intent.type, 'produit');
    assert.equal(r?.forme, 'produit');
  });

  it('laisse une adresse aux données même avec une tournure produit', () => {
    const r = routeQuestion("C'est quoi le 12 rue Vitruve ?");
    assert.equal(r?.intent.type, 'immeuble');
  });

  it('couvre les sujets rédigés dans le dépôt', () => {
    const sujets = sujetsProduit();
    assert.ok(sujets.length >= 10, `${sujets.length} sujets`);
    for (const question of [
      'À quoi sert la carte ?',
      'Ça veut dire quoi la vérification marché ?',
      "C'est quoi le pipeline ?",
      'Comment faire une estimation ?',
      "C'est quoi la couche cadastre ?",
    ]) {
      assert.equal(routeQuestion(question)?.intent.type, 'produit', question);
    }
  });
});
