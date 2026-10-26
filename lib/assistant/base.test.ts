import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AssistantSource, CollecteLigne } from './collecte';
import {
  ajusterPourCriteres,
  criteresDits,
  enteteLecture,
  ligneCompacte,
  piecesDans,
  sourcesCitees,
  texteBase,
  texteSansMarkdown,
} from './base';

function ligne(kind: CollecteLigne['kind'], id: string, faits: Record<string, unknown>): CollecteLigne {
  return { kind, id, date: null, auteur: null, faits };
}

function source(kind: AssistantSource['kind'], id: string, titre: string): AssistantSource {
  return { kind, id, typeLabel: kind, titre, date: null, auteur: null, href: `/x/${id}` };
}

describe('base — lignes compactes', () => {
  it('une fiche par ligne, dates au jour près, champs vides omis', () => {
    const t = ligneCompacte(
      ligne('contact', 'c1', {
        nom: 'Sophie Dubois',
        type: 'acquereur',
        codes_postaux: ['75011', '75020'],
        date_creation: '2026-10-01T08:12:00.000Z',
        email: null,
      }),
    );
    assert.equal(
      t,
      'Contact | nom: Sophie Dubois | type: acquereur | codes_postaux: 75011, 75020 | date_creation: 2026-10-01',
    );
  });

  it('annonce les fiches laissées de côté faute de place', () => {
    const lignes = Array.from({ length: 50 }, (_, i) => ligne('contact', `c${i}`, { nom: `Contact numéro ${i}` }));
    const out = texteBase(lignes, 400);
    assert.ok(out.lues > 0 && out.lues < 50);
    assert.equal(out.omises, 50 - out.lues);
    assert.match(out.texte, /fiches plus anciennes non lues/);
  });
});

describe('base — critères dits', () => {
  it('lit budget, pièces et surface dans une question dictée', () => {
    assert.deepEqual(criteresDits('Qui cherche un trois pièces avec 450 000 euros ?'), {
      budget: 450_000,
      pieces: 3,
      surface: null,
    });
    assert.deepEqual(criteresDits('Un T2 de 45 m² à 300k'), { budget: 300_000, pieces: 2, surface: 45 });
    assert.equal(criteresDits('budget 1,2 million').budget, 1_200_000);
    assert.equal(criteresDits('avec 450 000').budget, 450_000);
  });

  it('un code postal n’est pas un budget', () => {
    assert.deepEqual(criteresDits('Qui sont mes acquéreurs dans le 75011 ?'), {
      budget: null,
      pieces: null,
      surface: null,
    });
  });

  it('trouve toutes les pièces écrites dans un résumé', () => {
    assert.deepEqual(piecesDans('Cherche un 2 pièces ou un trois pièces, voire un T4').sort(), [2, 3, 4]);
    assert.deepEqual(piecesDans('Un studio meublé'), [1]);
  });

  it('écarte les acquéreurs qui ne collent pas, garde ceux à vérifier en dernier', () => {
    const lignes = [
      ligne('contact', 'trop-court', { nom: 'A', type: 'acquereur', budget_max: 300_000, resume: 'un 3 pièces' }),
      ligne('contact', 'pas-de-budget', { nom: 'B', type: 'acquereur', resume: 'un 3 pièces' }),
      ligne('contact', 'ok', { nom: 'C', type: 'vendeur', autres_roles: ['acquereur'], budget_max: 430_000, resume: 'Cherche un 3 pièces' }),
      ligne('contact', 'deux-pieces', { nom: 'D', type: 'acquereur', budget_max: 500_000, resume: 'un 2 pièces' }),
      ligne('contact', 'vendeur', { nom: 'E', type: 'vendeur' }),
      ligne('bien', 'b1', { adresse: '12 rue Vitruve' }),
    ];
    const criteres = criteresDits('un trois pièces avec 450 000 €');
    const out = ajusterPourCriteres(lignes, criteres);
    assert.deepEqual(
      out.map((l) => l.id),
      ['ok', 'pas-de-budget', 'vendeur', 'b1'],
    );
    assert.equal(out[0]?.faits.correspond, 'oui');
    assert.match(String(out[1]?.faits.correspond), /à vérifier \(budget/);
    assert.match(enteteLecture(out, criteres), /dont 2 acquéreurs/);
  });

  it('sans critère chiffré, rien ne bouge', () => {
    const lignes = [ligne('contact', 'c1', { nom: 'A', type: 'acquereur' })];
    assert.deepEqual(ajusterPourCriteres(lignes, criteresDits('Qui sont mes acquéreurs ?')), lignes);
  });
});

describe('base — texte brut', () => {
  it('retire le gras, l’italique et les titres glissés par le modèle', () => {
    assert.equal(
      texteSansMarkdown('## Résultat\n**3 acquéreurs** :\n* Karim *06 12*'),
      'Résultat\n3 acquéreurs :\n— Karim 06 12',
    );
  });
});

describe('base — sources citées', () => {
  const lignes = [
    ligne('contact', 'c1', { nom: 'Sophie Dubois' }),
    ligne('contact', 'c2', { nom: 'Paul Martin' }),
    ligne('contact', 'c3', { nom: 'Anne Martin' }),
    ligne('contact', 'c4', { nom: 'Léa Rousseau' }),
    ligne('bien', 'b1', { adresse: '12 rue Vitruve, 75020 Paris' }),
  ];
  const sources = [
    source('contact', 'c1', 'Sophie Dubois'),
    source('contact', 'c2', 'Paul Martin'),
    source('contact', 'c3', 'Anne Martin'),
    source('contact', 'c4', 'Léa Rousseau'),
    source('bien', 'b1', '12 rue Vitruve'),
  ];

  it('garde les fiches nommées, dans l’ordre de la réponse', () => {
    const reponse =
      'Deux acquéreurs : — Rousseau (06 12) — Sophie Dubois, budget 400 000 €. Le 12 rue Vitruve leur irait.';
    assert.deepEqual(
      sourcesCitees(reponse, lignes, sources).map((s) => s.id),
      ['c4', 'c1', 'b1'],
    );
  });

  it('une fiche au nom d’un seul mot ne se cite pas par le prénom d’une autre', () => {
    const avecMartinSeul = [...lignes, ligne('contact', 'c5', { nom: 'Martin' })];
    const avecSource = [...sources, source('contact', 'c5', 'Martin')];
    assert.deepEqual(
      sourcesCitees('— Martin Benoît, budget 300 000 €', avecMartinSeul, avecSource).map((s) => s.id),
      [],
    );
  });

  it('un nom de famille porté par deux fiches ne suffit pas', () => {
    assert.deepEqual(sourcesCitees('Voir avec Martin.', lignes, sources), []);
    assert.deepEqual(
      sourcesCitees('Voir avec Paul Martin.', lignes, sources).map((s) => s.id),
      ['c2'],
    );
  });
});
