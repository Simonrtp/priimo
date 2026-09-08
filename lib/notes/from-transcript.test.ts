import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { guessPersonneFromTranscript, guessPersonnesFromTranscript, matchContactsInTranscript, matchMembersInTranscript } from './from-transcript';
import type { MatchableContact } from './match';

const simon: MatchableContact = {
  id: 'c-simon',
  agencyId: 'a1',
  firstName: 'Simon',
  lastName: 'Ropiot',
  fullName: 'Simon Ropiot',
  phone: '0611223344',
  email: null,
  address: null,
  banId: null,
};

const jean: MatchableContact = {
  id: 'c-jean',
  agencyId: 'a1',
  firstName: 'Jean',
  lastName: 'Martin',
  fullName: 'Jean Martin',
  phone: null,
  email: null,
  address: null,
  banId: null,
};

const amelieJacquet: MatchableContact = {
  id: 'c-jacquet',
  agencyId: 'a1',
  firstName: 'Amélie',
  lastName: 'Jacquet',
  fullName: 'Amélie Jacquet',
  phone: null,
  email: null,
  address: null,
  banId: null,
};

const ameliePerrot: MatchableContact = {
  id: 'c-perrot',
  agencyId: 'a1',
  firstName: 'Amélie',
  lastName: 'Perrot',
  fullName: 'Amélie Perrot',
  phone: null,
  email: null,
  address: null,
  banId: null,
};

const DICTEE_AMELIE =
  "C'est mon repère, on a envie d'avoir plus d'informations par rapport à Amélie Jacquet. En fait, ils sont très copains tous les deux et ils ont envie de vendre leur appartement en même temps. Par Thomas Perrin.";

describe('guessPersonneFromTranscript', () => {
  it('lit le nom après « contacter »', () => {
    const guessed = guessPersonneFromTranscript(
      'Il faut contacter Simon Ropiot, puisqu’il veut avoir des informations concernant le mobilier de son appartement.',
    );
    assert.equal(guessed?.firstName, 'Simon');
    assert.equal(guessed?.lastName, 'Ropiot');
  });

  it('lit un nom en minuscules après le verbe', () => {
    const guessed = guessPersonneFromTranscript('il faut contacter simon ropiot demain');
    assert.equal(guessed?.firstName, 'Simon');
    assert.equal(guessed?.lastName, 'Ropiot');
  });

  it('n’invente pas un nom après « contacter le propriétaire »', () => {
    assert.equal(guessPersonneFromTranscript('Il faut contacter le propriétaire'), null);
  });

  it('lit tous les noms d’une dictée, pas seulement le premier', () => {
    const guessed = guessPersonnesFromTranscript(DICTEE_AMELIE);
    assert.deepEqual(
      guessed.map((p) => `${p.firstName} ${p.lastName}`),
      ['Amélie Jacquet', 'Thomas Perrin'],
    );
  });
});

describe('matchContactsInTranscript', () => {
  it('rattache un contact dont le nom complet est dans la dictée', () => {
    const hits = matchContactsInTranscript(
      'Il faut contacter Simon Ropiot pour le mobilier.',
      [simon, jean],
      'a1',
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.contactId, 'c-simon');
    assert.equal(hits[0]?.raison, 'nom');
  });

  it('ne prend pas Jean Martin dans « quartier Saint-Martin »', () => {
    const hits = matchContactsInTranscript('Vu au quartier Saint-Martin ce matin', [jean], 'a1');
    assert.equal(hits.length, 0);
  });

  it('reconnaît un téléphone cité', () => {
    const hits = matchContactsInTranscript('Son numéro 06 11 22 33 44', [simon], 'a1');
    assert.equal(hits[0]?.confiance, 'certain');
    assert.equal(hits[0]?.raison, 'telephone');
  });

  it('ne rattache pas une homonyme dont le nom n’est pas dit', () => {
    const hits = matchContactsInTranscript(DICTEE_AMELIE, [amelieJacquet, ameliePerrot], 'a1');
    assert.deepEqual(
      hits.map((h) => h.contactId),
      ['c-jacquet'],
    );
  });
});

describe('matchMembersInTranscript', () => {
  it('reconnaît le conseiller nommé en fin de dictée', () => {
    const hits = matchMembersInTranscript(DICTEE_AMELIE, [
      { id: 'm-thomas', fullName: 'Thomas Perrin' },
      { id: 'm-other', fullName: 'Marie Curie' },
    ]);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.memberId, 'm-thomas');
  });
});
