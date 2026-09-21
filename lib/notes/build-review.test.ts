import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildReviewPayload } from './build-review';
import type { Contact } from '@/types/contact';

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
});
