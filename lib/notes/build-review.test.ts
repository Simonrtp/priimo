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
});
