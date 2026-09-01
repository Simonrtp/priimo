import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Contact, ContactType, SearchCriteria } from '../../types/contact';
import {
  argumentaireVendeur,
  proposerRapprochementsInverses,
  RAPPROCHEMENT_INVERSE_CONFIG,
  type BienHorsMandat,
} from './rapprochement-inverse';

const NOW = new Date('2026-08-31T09:00:00.000Z');

function acquereur(
  name: string,
  criteria: Partial<SearchCriteria>,
  type: ContactType = 'acquereur',
): Contact {
  return {
    id: name,
    agencyId: 'agency-a',
    createdBy: null,
    firstName: name,
    lastName: '',
    fullName: name,
    type,
    phone: '0600000000',
    email: null,
    secteur: null,
    criteria: {
      budgetMin: null,
      budgetMax: null,
      surfaceMin: null,
      surfaceMax: null,
      roomsMin: null,
      postalCodes: [],
      ...criteria,
    },
    summary: null,
    lastInteractionAt: null,
    recontacterLe: null,
    doublonDe: null,
    source: 'manuel',
    address: null,
    banId: null,
    latitude: null,
    longitude: null,
    leadId: null,
    assignedTo: null,
    assignedBy: null,
    assignedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function bien(over: Partial<BienHorsMandat> = {}): BienHorsMandat {
  return {
    id: 'bien-1',
    address: '12 rue de la Paix',
    postalCode: '44000',
    price: 300_000,
    surfaceM2: 80,
    rooms: 4,
    mandatStatut: 'estimation',
    proprietaireName: 'M. Durand',
    proprietairePhone: '0611223344',
    assignedTo: 'agent-1',
    createdBy: 'agent-2',
    createdAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

const parfait = acquereur('Marie', {
  budgetMax: 320_000,
  surfaceMin: 70,
  roomsMin: 3,
  postalCodes: ['44000'],
});

describe('proposerRapprochementsInverses', () => {
  it('propose un bien estimé quand un acquéreur correspond', () => {
    const [action, ...reste] = proposerRapprochementsInverses({
      biens: [bien()],
      acquereurs: [parfait],
      now: NOW,
    });

    assert.equal(reste.length, 0);
    assert.equal(action?.kind, 'rapprochement_inverse');
    assert.equal(action?.titre, 'Un acquéreur pour le 12 rue de la Paix');
    assert.match(String(action?.detail), /jamais rentré au mandat/);
  });

  it('ignore un bien déjà au mandat — la fiche le montre déjà', () => {
    for (const statut of ['mandat_simple', 'mandat_exclusif', 'compromis', 'vendu'] as const) {
      const actions = proposerRapprochementsInverses({
        biens: [bien({ mandatStatut: statut })],
        acquereurs: [parfait],
        now: NOW,
      });
      assert.equal(actions.length, 0, `statut ${statut} ne doit rien proposer`);
    }
  });

  it('ignore une estimation trop ancienne pour être un prétexte crédible', () => {
    const actions = proposerRapprochementsInverses({
      biens: [bien({ createdAt: '2024-01-01T00:00:00.000Z' })],
      acquereurs: [parfait],
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('exige un score plus élevé que le rapprochement consulté à l’écran', () => {
    assert.ok(RAPPROCHEMENT_INVERSE_CONFIG.scoreMinimum > 55);
    // Hors secteur : rejeté par le moteur, donc aucune proposition.
    const actions = proposerRapprochementsInverses({
      biens: [bien({ postalCode: '75001' })],
      acquereurs: [parfait],
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('assigne la proposition à celui qui a fait l’estimation', () => {
    const [action] = proposerRapprochementsInverses({
      biens: [bien({ assignedTo: 'agent-7' })],
      acquereurs: [parfait],
      now: NOW,
    });
    assert.equal(action?.assignedTo, 'agent-7');
  });

  it('retombe sur l’auteur quand le bien n’est assigné à personne', () => {
    const [action] = proposerRapprochementsInverses({
      biens: [bien({ assignedTo: null, createdBy: 'agent-9' })],
      acquereurs: [parfait],
      now: NOW,
    });
    assert.equal(action?.assignedTo, 'agent-9');
  });

  it('note mieux un bien convoité par plusieurs acquéreurs', () => {
    // Budget légèrement dépassé : correspondance solide mais pas parfaite,
    // c'est là que le bonus de convoitise se voit (un 100 reste un 100).
    const serres = ['Paul', 'Lea', 'Hugo'].map((nom) =>
      acquereur(nom, { budgetMax: 280_000, postalCodes: ['44000'] }),
    );

    const seul = proposerRapprochementsInverses({
      biens: [bien()],
      acquereurs: [serres[0]!],
      now: NOW,
    });
    const trois = proposerRapprochementsInverses({
      biens: [bien()],
      acquereurs: serres,
      now: NOW,
    });

    assert.ok((trois[0]?.score ?? 0) > (seul[0]?.score ?? 0));
    assert.equal(trois[0]?.titre, '3 acquéreurs pour le 12 rue de la Paix');
  });

  it('ne dépasse jamais 100, même très convoité', () => {
    const [action] = proposerRapprochementsInverses({
      biens: [bien()],
      acquereurs: [
        parfait,
        acquereur('Paul', { budgetMax: 320_000, surfaceMin: 70, postalCodes: ['44000'] }),
        acquereur('Lea', { budgetMax: 350_000, surfaceMin: 70, postalCodes: ['44000'] }),
      ],
      now: NOW,
    });
    assert.equal(action?.score, 100);
  });

  it('garde la même clé tant que le meilleur acquéreur ne change pas', () => {
    const a = proposerRapprochementsInverses({ biens: [bien()], acquereurs: [parfait], now: NOW });
    const b = proposerRapprochementsInverses({
      biens: [bien()],
      acquereurs: [parfait, acquereur('Zoe', { budgetMax: 200_000, postalCodes: ['44000'] })],
      now: NOW,
    });
    assert.equal(a[0]?.dedupKey, b[0]?.dedupKey);
  });

  it('produit une nouvelle clé quand un meilleur acquéreur arrive', () => {
    const avant = proposerRapprochementsInverses({
      biens: [bien()],
      acquereurs: [acquereur('Paul', { budgetMax: 320_000, postalCodes: ['44000'] })],
      now: NOW,
    });
    const apres = proposerRapprochementsInverses({
      biens: [bien()],
      acquereurs: [
        acquereur('Paul', { budgetMax: 320_000, postalCodes: ['44000'] }),
        acquereur('Ana', {
          budgetMax: 320_000,
          surfaceMin: 75,
          roomsMin: 4,
          postalCodes: ['44000'],
        }),
      ],
      now: NOW,
    });
    assert.notEqual(avant[0]?.dedupKey, apres[0]?.dedupKey);
  });

  it('ignore un contact qui n’est pas acquéreur', () => {
    const actions = proposerRapprochementsInverses({
      biens: [bien()],
      acquereurs: [acquereur('Vendeur', { postalCodes: ['44000'] }, 'vendeur')],
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('plafonne le nombre de propositions par passage', () => {
    const biens = Array.from({ length: 25 }, (_, i) => bien({ id: `bien-${i}` }));
    const actions = proposerRapprochementsInverses({ biens, acquereurs: [parfait], now: NOW });
    assert.equal(actions.length, RAPPROCHEMENT_INVERSE_CONFIG.maxPropositions);
  });

  it('pose une péremption : un signal froid disparaît de lui-même', () => {
    const [action] = proposerRapprochementsInverses({
      biens: [bien()],
      acquereurs: [parfait],
      now: NOW,
    });
    const expire = Date.parse(String(action?.expiresAt));
    assert.ok(expire > NOW.getTime());
    assert.ok(expire <= NOW.getTime() + 31 * 86_400_000);
  });

  it('transporte de quoi appeler sans ouvrir une autre fiche', () => {
    const [action] = proposerRapprochementsInverses({
      biens: [bien()],
      acquereurs: [parfait],
      now: NOW,
    });
    assert.equal(action?.payload.proprietairePhone, '0611223344');
    assert.equal(action?.payload.bienId, 'bien-1');
    assert.ok(Array.isArray(action?.payload.acquereurs));
  });
});

describe('argumentaireVendeur', () => {
  it('nomme le propriétaire et compte les acquéreurs', () => {
    const phrase = argumentaireVendeur(bien(), [
      { contact: parfait, score: 90, raisons: [] },
      { contact: parfait, score: 80, raisons: [] },
    ]);
    assert.match(phrase, /^Bonjour M\. Durand, /);
    assert.match(phrase, /2 acquéreurs/);
    assert.match(phrase, /sur le 44000/);
    assert.match(phrase, /toujours d'actualité \?$/);
  });

  it('reste correcte au singulier et sans propriétaire connu', () => {
    const phrase = argumentaireVendeur(bien({ proprietaireName: null, postalCode: null }), [
      { contact: parfait, score: 90, raisons: [] },
    ]);
    assert.match(phrase, /^Bonjour, j'ai actuellement un acquéreur/);
    assert.doesNotMatch(phrase, /sur le null/);
  });
});
