import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  actionsDepuisReview,
  buildReviewPayload,
  fusionnerPersonnesProches,
  type PersonneProposal,
} from './build-review';
import type { Contact } from '@/types/contact';
import { EMPTY_NOTE_EXTRACTION } from '@/lib/notes/propositions';

const simon = {
  id: 'c-simon',
  agencyId: 'a1',
  firstName: 'Simon',
  lastName: 'Ropiot',
  fullName: 'Simon Ropiot',
  phone: null,
  email: null,
  address: null,
  banId: null,
} as Pick<
  Contact,
  'id' | 'agencyId' | 'firstName' | 'lastName' | 'fullName' | 'phone' | 'email' | 'address' | 'banId'
>;

describe('buildReviewPayload — fallback dictée', () => {
  it('propose Simon Ropiot même si l’extraction a échoué', () => {
    const review = buildReviewPayload({
      voiceNoteId: 'n1',
      transcript:
        'Il faut contacter Simon Ropiot, puisqu’il veut avoir des informations concernant le mobilier de son appartement.',
      visibilite: 'agence',
      extraction: null,
      extractFailed: true,
      contacts: [simon],
      agencyId: 'a1',
      geo: { ban_id: null, adresse_normalisee: null, geocode_score: null },
    });
    assert.equal(review.personnes.length, 1);
    assert.equal(review.personnes[0]?.personne.firstName, 'Simon');
    assert.equal(review.personnes[0]?.personne.lastName, 'Ropiot');
    assert.equal(review.personnes[0]?.matches[0]?.contactId, 'c-simon');
  });

  it('garde le nom à particule proposé par l’extraction et remplit la fiche', () => {
    const review = buildReviewPayload({
      voiceNoteId: 'n2',
      transcript:
        "J'ai rencontré Catherine de Villeneuve. Elle habite au 161 avenue Ledru-Rolin, dans le 11e.",
      visibilite: 'agence',
      extraction: {
        personnes: [
          {
            firstName: 'Catherine',
            lastName: 'de Villeneuve',
            phone: null,
            email: null,
            type: 'acquereur',
          },
        ],
        address: '161 avenue Ledru-Rolin',
        secteur: '11e',
        prix: null,
        rooms: null,
        surface: null,
        sourceInfo: null,
        relance: null,
        promesse: null,
        rendezVous: null,
        visite: null,
      },
      extractFailed: false,
      contacts: [],
      agencyId: 'a1',
      geo: { ban_id: null, adresse_normalisee: null, geocode_score: null },
    });
    assert.equal(review.personnes[0]?.personne.lastName, 'de Villeneuve');
    assert.equal(review.immeuble?.address, '161 avenue Ledru-Rolin');
    assert.equal(review.secteur, '11e');
  });

  it('rattache le numéro dicté au contact proposé, même ponctué', () => {
    const review = buildReviewPayload({
      voiceNoteId: 'n3',
      transcript:
        "J'ai rencontré Nicolas, il est intéressé pour un bien dans le Marais à 1,2 millions. Son numéro de téléphone, c'est 06 87 71. 28, 42.",
      visibilite: 'agence',
      extraction: {
        personnes: [
          {
            firstName: 'Nicolas',
            lastName: '',
            phone: null,
            email: null,
            type: 'acquereur',
          },
        ],
        address: null,
        secteur: 'le Marais',
        prix: 1_200_000,
        rooms: null,
        surface: null,
        sourceInfo: null,
        relance: null,
        promesse: null,
        rendezVous: null,
        visite: null,
      },
      extractFailed: false,
      contacts: [],
      agencyId: 'a1',
      geo: { ban_id: null, adresse_normalisee: null, geocode_score: null },
    });
    assert.equal(review.personnes[0]?.personne.firstName, 'Nicolas');
    assert.equal(review.personnes[0]?.personne.phone, '0687712842');
    assert.equal(review.prix, 1_200_000);
    assert.equal(review.secteur, 'le Marais');
  });

  it('propose une adresse lue dans la dictée, même sans extraction', () => {
    const review = buildReviewPayload({
      voiceNoteId: 'n4',
      transcript: 'j’ai vu monsieur martin durand au 12 rue de la paix',
      visibilite: 'agence',
      extraction: null,
      extractFailed: true,
      contacts: [],
      agencyId: 'a1',
      geo: { ban_id: null, adresse_normalisee: null, geocode_score: null },
    });
    assert.equal(review.personnes[0]?.personne.lastName, 'Durand');
    assert.ok(review.immeuble?.address.toLowerCase().includes('12 rue de la paix'));
    const actions = actionsDepuisReview(review);
    assert.ok(actions.some((a) => a.titre.includes('Martin Durand')));
    assert.ok(actions.some((a) => a.id === 'immeuble'));
  });

  // Dictée réelle du 30/10/2026 : deux fiches « Ben Ali » pour une seule personne.
  const BEN_ALI =
    "Dis-moi, j'aimerais que tu me crées une fiche contact pour Ben Ali Benoît. Qui habite dans le 16e arrondissement actuellement, mais qui va vendre dans le 16e et qui va acheter un appartement dans le 20e arrondissement. Son numéro de téléphone, c'est 07 66 85 71 65.";
  const lirePersonne = (firstName: string, lastName: string, type: 'acquereur' | 'vendeur') =>
    buildReviewPayload({
      voiceNoteId: 'n-ben',
      transcript: BEN_ALI,
      visibilite: 'agence',
      extraction: {
        ...EMPTY_NOTE_EXTRACTION,
        personnes: [{ firstName, lastName, phone: null, email: null, type, autresTypes: [] }],
      },
      extractFailed: false,
      contacts: [],
      agencyId: 'a1',
      geo: { ban_id: null, adresse_normalisee: null, geocode_score: null },
    });

  it('ne refait pas une seconde fiche avec le nom composé repéré dans le texte', () => {
    for (const [prenom, nom] of [
      ['Benoît', 'Ben Ali'],
      ['Benoît', 'Ali'],
    ] as const) {
      const review = lirePersonne(prenom, nom, 'vendeur');
      assert.equal(review.personnes.length, 1, `${prenom} ${nom}`);
      assert.equal(review.personnes[0]?.personne.phone, '0766857165');
    }
  });

  it('rend la casquette oubliée par le modèle quand la dictée la dit', () => {
    const review = lirePersonne('Benoît', 'Ben Ali', 'acquereur');
    const p = review.personnes[0]!.personne;
    assert.deepEqual([p.type, ...(p.autresTypes ?? [])].sort(), ['acquereur', 'vendeur']);
  });

  it('retire la casquette que la dictée retire', () => {
    const review = buildReviewPayload({
      voiceNoteId: 'n-retrait',
      transcript: 'Paul Lefort veut vendre son appartement. Finalement il ne vend plus, il va acheter plus grand.',
      visibilite: 'agence',
      extraction: {
        ...EMPTY_NOTE_EXTRACTION,
        personnes: [{ firstName: 'Paul', lastName: 'Lefort', phone: null, email: null, type: 'vendeur', autresTypes: ['acquereur'] }],
      },
      extractFailed: false,
      contacts: [],
      agencyId: 'a1',
      geo: { ban_id: null, adresse_normalisee: null, geocode_score: null },
    });
    const p = review.personnes[0]!.personne;
    assert.equal(p.type, 'acquereur');
    assert.deepEqual(p.autresTypes, []);
  });

  it('garde deux personnes de la même famille distinctes', () => {
    const review = buildReviewPayload({
      voiceNoteId: 'n-famille',
      transcript: 'Paul Martin et Marie Martin veulent vendre.',
      visibilite: 'agence',
      extraction: {
        ...EMPTY_NOTE_EXTRACTION,
        personnes: [
          { firstName: 'Paul', lastName: 'Martin', phone: null, email: null, type: 'vendeur' },
          { firstName: 'Marie', lastName: 'Martin', phone: null, email: null, type: 'vendeur' },
        ],
      },
      extractFailed: false,
      contacts: [],
      agencyId: 'a1',
      geo: { ban_id: null, adresse_normalisee: null, geocode_score: null },
    });
    assert.equal(review.personnes.length, 2);
  });

  it('fusionne Martyne et Martine en un seul contact', () => {
    const vide = { phone: null, email: null, type: 'autre' as const };
    const a: PersonneProposal = {
      id: 'p0',
      personne: { ...vide, firstName: 'Martine', lastName: '', type: 'vendeur' },
      matches: [],
    };
    const b: PersonneProposal = {
      id: 'p-guess-1',
      personne: { ...vide, firstName: 'Martyne', lastName: '' },
      matches: [],
    };
    const fusion = fusionnerPersonnesProches([a, b]);
    assert.equal(fusion.length, 1);
    assert.equal(fusion[0]?.personne.firstName, 'Martine');
    assert.equal(fusion[0]?.personne.type, 'vendeur');
  });
});
