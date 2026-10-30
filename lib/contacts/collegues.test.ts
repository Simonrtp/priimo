import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cleDoublonContact,
  conflitsChezCollegues,
  indexerChezCollegues,
  messageChezCollegue,
  propositionDoublon,
  type FicheDuplicable,
} from './collegues';

const DIR = { id: 'dir', role: 'directeur' as const };
const MARC = { id: 'marc', role: 'collaborateur' as const };

function fiche(id: string, titulaire: string | null, phone: string | null, email: string | null = null): FicheDuplicable {
  return { id, assignedTo: titulaire, createdBy: titulaire, phone, email };
}

const FICHES = [
  fiche('c-julie', 'julie', '06 12 34 56 78', 'Julie.Client@Mail.fr'),
  fiche('c-marc', 'marc', '06 99 99 99 99'),
  fiche('c-sans', 'julie', null, null),
];

describe('conflitsChezCollegues', () => {
  it('repère le numéro d’un collègue, quel que soit son format', () => {
    const conflits = conflitsChezCollegues(MARC, { phone: '+33 6 12 34 56 78', email: null }, FICHES);
    assert.deepEqual(conflits, [{ contactId: 'c-julie', titulaireId: 'julie', raison: 'telephone' }]);
  });

  it('repère l’e-mail d’un collègue sans tenir compte de la casse', () => {
    const conflits = conflitsChezCollegues(MARC, { phone: null, email: 'julie.client@mail.fr' }, FICHES);
    assert.equal(conflits[0]?.raison, 'email');
    assert.equal(conflits[0]?.titulaireId, 'julie');
  });

  it('ignore ses propres fiches : le contrôle ordinaire s’en charge', () => {
    assert.deepEqual(conflitsChezCollegues(MARC, { phone: '0699999999', email: null }, FICHES), []);
  });

  it('ne bloque pas la direction, qui voit tout', () => {
    assert.deepEqual(conflitsChezCollegues(DIR, { phone: '0612345678', email: null }, FICHES), []);
  });

  it('ne se déclenche pas sans téléphone ni e-mail, ni sur un numéro trop court', () => {
    assert.deepEqual(conflitsChezCollegues(MARC, { phone: null, email: null }, FICHES), []);
    assert.deepEqual(conflitsChezCollegues(MARC, { phone: '0612', email: null }, FICHES), []);
  });

  it('ne se déclenche pas sur le seul nom', () => {
    const homonyme = [fiche('c-x', 'julie', null, null)];
    assert.deepEqual(conflitsChezCollegues(MARC, { phone: null, email: null }, homonyme), []);
  });

  it('range le téléphone avant l’e-mail', () => {
    const fiches = [fiche('c-mail', 'paul', null, 'x@y.fr'), fiche('c-tel', 'julie', '0612345678')];
    const conflits = conflitsChezCollegues(MARC, { phone: '0612345678', email: 'x@y.fr' }, fiches);
    assert.deepEqual(
      conflits.map((c) => c.raison),
      ['telephone', 'email'],
    );
  });

  it('rend un titulaire nul quand la fiche n’en a plus', () => {
    const orpheline = [fiche('c-o', null, '0612345678')];
    // Sans titulaire, un négociateur ne la voit pas non plus : elle compte comme celle d’un collègue.
    assert.equal(conflitsChezCollegues(MARC, { phone: '0612345678', email: null }, orpheline)[0]?.titulaireId, null);
  });
});

describe('indexerChezCollegues', () => {
  const index = indexerChezCollegues(MARC, FICHES);

  it('donne la même réponse que la comparaison une à une', () => {
    assert.equal(index.trouver({ phone: '06.12.34.56.78', email: null })?.contactId, 'c-julie');
    assert.equal(index.trouver({ phone: null, email: ' JULIE.CLIENT@mail.fr ' })?.raison, 'email');
    assert.equal(index.trouver({ phone: '0699999999', email: null }), null);
    assert.equal(index.trouver({ phone: null, email: null }), null);
  });

  it('reste muet pour la direction', () => {
    assert.equal(indexerChezCollegues(DIR, FICHES).trouver({ phone: '0612345678', email: null }), null);
  });
});

describe('messages', () => {
  const julie = { nom: 'Julie Martin', telephone: '0612345678', email: 'julie@agence.fr' };

  it('nomme le titulaire, avec ou sans ses coordonnées', () => {
    assert.equal(messageChezCollegue(julie), 'Ce contact est déjà suivi par Julie Martin.');
    assert.equal(
      messageChezCollegue(julie, true),
      'Ce contact est déjà suivi par Julie Martin. 06 12 34 56 78 · julie@agence.fr',
    );
  });

  it('reste correct quand le titulaire est introuvable', () => {
    assert.equal(messageChezCollegue(null), "Ce contact est déjà dans la base de l'agence.");
  });
});

describe('propositionDoublon', () => {
  const titulaire = { id: 'julie', prenom: 'Julie', nomComplet: 'Julie Martin', telephone: null, email: null };
  const proposition = propositionDoublon({
    auteurId: 'marc',
    auteurPrenom: 'Marc',
    nomSaisi: 'Jean Dupont',
    contactId: 'c-julie',
    titulaire,
    raison: 'telephone',
    saisie: { firstName: 'Jean', lastName: 'Dupont', phone: '0612345678' },
  });

  it('est réservée à la direction et adressée à personne en particulier', () => {
    assert.equal(proposition.kind, 'doublon_contact');
    assert.equal(proposition.assignedTo, null);
  });

  it('dit qui a tenté quoi, et chez qui est la fiche', () => {
    assert.equal(proposition.titre, "Marc a tenté d'ajouter Jean Dupont");
    assert.match(proposition.detail ?? '', /Julie Martin/);
    assert.match(proposition.detail ?? '', /même téléphone/);
  });

  it('garde la saisie à rejouer et l’auteur', () => {
    assert.equal(proposition.payload.auteurId, 'marc');
    assert.deepEqual(proposition.payload.saisie, { firstName: 'Jean', lastName: 'Dupont', phone: '0612345678' });
  });

  it('ne prévient qu’une fois par négociateur et par fiche', () => {
    assert.equal(proposition.dedupKey, cleDoublonContact('marc', 'c-julie'));
    assert.notEqual(proposition.dedupKey, cleDoublonContact('paul', 'c-julie'));
  });
});
