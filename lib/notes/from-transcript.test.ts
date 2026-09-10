import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  guessPersonneFromTranscript,
  guessPersonnesFromTranscript,
  matchContactsInTranscript,
  matchMembersInTranscript,
  personneCitedInTranscript,
  recadrerPersonne,
} from './from-transcript';
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

const DICTEE_CATHERINE =
  "J'ai rencontré Catherine de Villeneuve. Elle est hyper intéressée pour avoir des informations concernant nos estimations. Et elle habite au 161 avenue Ledru-Rolin, dans le 11e.";

describe('personneCitedInTranscript', () => {
  it('accepte un nom à particule que le lecteur de paires ne voit pas', () => {
    assert.equal(
      personneCitedInTranscript(
        { firstName: 'Catherine', lastName: 'de Villeneuve', phone: null },
        DICTEE_CATHERINE,
      ),
      true,
    );
  });

  it('accepte un prénom seul réellement prononcé', () => {
    assert.equal(
      personneCitedInTranscript(
        { firstName: 'Bertrand', lastName: '', phone: null },
        'Monsieur Bertrand vend son deux pièces rue Oberkampf.',
      ),
      true,
    );
  });

  it('refuse un nom absent de la dictée', () => {
    assert.equal(
      personneCitedInTranscript(
        { firstName: 'Emmanuel', lastName: 'Lemoine', phone: null },
        'Visite hier avec les Lemoine, ils vont faire une offre.',
      ),
      false,
    );
  });

  it('ne prend pas un nom caché dans un autre mot', () => {
    assert.equal(
      personneCitedInTranscript(
        { firstName: '', lastName: 'Martin', phone: null },
        'Vu au quartier Saint-Martinien ce matin',
      ),
      false,
    );
  });
});

describe('recadrerPersonne', () => {
  const base = { phone: null, email: null, type: 'autre' as const };

  it('ne garde que le patronyme quand le prénom est inventé', () => {
    const recadree = recadrerPersonne(
      { ...base, firstName: 'Emmanuel', lastName: 'Lemoine' },
      'Visite hier avec les Lemoine, ils vont faire une offre.',
    );
    assert.equal(recadree?.firstName, '');
    assert.equal(recadree?.lastName, 'Lemoine');
  });

  it('laisse intacte une personne entièrement citée', () => {
    const recadree = recadrerPersonne(
      { ...base, firstName: 'Catherine', lastName: 'de Villeneuve' },
      DICTEE_CATHERINE,
    );
    assert.equal(recadree?.firstName, 'Catherine');
    assert.equal(recadree?.lastName, 'de Villeneuve');
  });

  it('écarte une personne entièrement inventée', () => {
    assert.equal(
      recadrerPersonne({ ...base, firstName: 'Paul', lastName: 'Durand' }, 'Personne n’a ouvert.'),
      null,
    );
  });

  it('garde une personne reconnue par son téléphone', () => {
    const recadree = recadrerPersonne(
      { ...base, firstName: 'Bertrand', lastName: '', phone: '0612345678' },
      'Le monsieur du 06 12 34 56 78 vend son appartement.',
    );
    assert.equal(recadree?.firstName, 'Bertrand');
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
