import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AssistantSource, CollecteLigne } from './collecte';
import { ligneCompacte, sourcesCitees, texteBase } from './base';

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
