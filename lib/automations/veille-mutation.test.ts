import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AdresseSuivie } from './veille-dpe';
import {
  argumentaireVoisinage,
  moisEnToutesLettres,
  proposerVeilleMutations,
  VEILLE_MUTATION_CONFIG,
  type MutationRecente,
} from './veille-mutation';

const NOW = new Date('2026-08-31T09:00:00.000Z');
const SECTEUR = ['44000'];

function mutation(over: Partial<MutationRecente> = {}): MutationRecente {
  return {
    id: 'mut-1',
    idMutation: '2026-123456',
    adresse: '12 rue de la Paix',
    codePostal: '44000',
    dateMutation: '2026-03-15',
    decouverteLe: '2026-08-20T00:00:00.000Z',
    valeurFonciere: 285_000,
    surfaceM2: 82,
    prixM2: 3476,
    typeLocal: 'Appartement',
    ...over,
  };
}

function suivi(over: Partial<AdresseSuivie> = {}): AdresseSuivie {
  return {
    entite: 'bien',
    id: 'bien-1',
    adresse: '12 rue de la Paix',
    codePostal: '44000',
    label: 'M. Durand',
    assignedTo: 'agent-1',
    ...over,
  };
}

describe('moisEnToutesLettres', () => {
  it('rend le mois et l’année', () => {
    assert.equal(moisEnToutesLettres('2026-03-15'), 'mars 2026');
    assert.equal(moisEnToutesLettres('2026-12-01'), 'décembre 2026');
    assert.equal(moisEnToutesLettres('pas une date'), null);
  });
});

describe('proposerVeilleMutations', () => {
  it('propose une vente du secteur comme prétexte de voisinage', () => {
    const [action] = proposerVeilleMutations({
      mutations: [mutation()],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(action?.titre, 'Vente au 12 rue de la Paix');
    assert.equal(action?.payload.perdu, false);
    assert.match(String(action?.detail), /Vendu en mars 2026/);
  });

  it('mesure la fraîcheur à la découverte, pas à la date de vente', () => {
    // Vente vieille de 5 mois mais ingérée hier : DVF publie avec du retard,
    // le signal est neuf pour nous.
    const recent = proposerVeilleMutations({
      mutations: [mutation({ decouverteLe: '2026-08-30T00:00:00.000Z' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(recent.length, 1);

    // Même vente, découverte il y a des mois : déjà traitée.
    const vieux = proposerVeilleMutations({
      mutations: [mutation({ decouverteLe: '2026-04-01T00:00:00.000Z' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(vieux.length, 0);
  });

  it('écarte une vente trop ancienne pour servir de repère de prix', () => {
    const actions = proposerVeilleMutations({
      mutations: [mutation({ dateMutation: '2024-01-10' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('signale un mandat perdu quand l’adresse était suivie', () => {
    const [action] = proposerVeilleMutations({
      mutations: [mutation()],
      secteur: SECTEUR,
      adressesSuivies: [suivi()],
      now: NOW,
    });
    assert.equal(action?.titre, 'Vendu sans nous — 12 rue de la Paix');
    assert.equal(action?.payload.perdu, true);
    assert.equal(action?.assignedTo, 'agent-1');
    assert.ok((action?.score ?? 0) > 55);
  });

  it('ne promet pas d’argumentaire voisinage sur un mandat perdu', () => {
    const [action] = proposerVeilleMutations({
      mutations: [mutation()],
      secteur: SECTEUR,
      adressesSuivies: [suivi()],
      now: NOW,
    });
    assert.equal(action?.payload.argumentaire, undefined);
  });

  it('ignore une vente hors secteur', () => {
    const actions = proposerVeilleMutations({
      mutations: [mutation({ codePostal: '75001' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(actions.length, 0);
  });

  it('déduplique sur l’identifiant de mutation', () => {
    const [a] = proposerVeilleMutations({
      mutations: [mutation()],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    const [b] = proposerVeilleMutations({
      mutations: [mutation({ id: 'autre-ligne' })],
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(a?.dedupKey, b?.dedupKey);
  });

  it('plafonne le volume', () => {
    const mutations = Array.from({ length: 25 }, (_, i) =>
      mutation({ id: `m-${i}`, idMutation: `id-${i}`, adresse: `${i + 1} rue de la Paix` }),
    );
    const actions = proposerVeilleMutations({
      mutations,
      secteur: SECTEUR,
      adressesSuivies: [],
      now: NOW,
    });
    assert.equal(actions.length, VEILLE_MUTATION_CONFIG.maxPropositions);
  });
});

describe('argumentaireVoisinage', () => {
  it('annonce un fait public sans s’attribuer la vente', () => {
    const phrase = argumentaireVoisinage(mutation());
    assert.match(phrase, /une vente vient d'être enregistrée dans votre rue/);
    assert.match(phrase, /en mars 2026/);
    // Intl fr-FR sépare les milliers par une espace fine insécable, pas par
    // une espace ordinaire : la regex doit rester tolérante.
    assert.match(phrase, /3\s476\s€\/m²/);
    assert.doesNotMatch(phrase, /je viens de vendre/);
  });

  it('reste correcte sans prix connu', () => {
    const phrase = argumentaireVoisinage(mutation({ prixM2: null }));
    assert.doesNotMatch(phrase, /null/);
    assert.match(phrase, /Souhaitez-vous savoir ce que vaut votre bien/);
  });
});
