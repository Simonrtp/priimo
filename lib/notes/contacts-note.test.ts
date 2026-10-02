import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseNoteExtraction } from './propositions';
import { aLeRole, repartirRoles, rolesDuContact } from '@/types/contact';
import { parseContactInput } from '@/lib/contact-input';
import { matchContacts } from './match';
import { cartesDepuisReview } from '@/lib/voice/cartes';
import { buildReviewPayload } from './build-review';

const REF = new Date('2026-10-02T09:00:00Z');

describe('rôles multiples', () => {
  it('une vendeuse qui achète : vendeur principal, acquéreur en plus', () => {
    assert.deepEqual(repartirRoles(['acquereur', 'vendeur']), { type: 'vendeur', autresTypes: ['acquereur'] });
  });

  it('« autre » ne reste que seul', () => {
    assert.deepEqual(rolesDuContact({ type: 'autre', autresTypes: ['acquereur'] }), ['acquereur']);
    assert.deepEqual(rolesDuContact({ type: 'autre', autresTypes: [] }), ['autre']);
    assert.deepEqual(repartirRoles([]), { type: 'autre', autresTypes: [] });
  });

  it('aLeRole lit aussi les rôles secondaires', () => {
    const c = { type: 'vendeur' as const, autresTypes: ['acquereur' as const] };
    assert.equal(aLeRole(c, 'acquereur'), true);
    assert.equal(aLeRole(c, 'locataire'), false);
  });

  it('la saisie range les rôles dans le même ordre, d’où qu’ils viennent', () => {
    const r = parseContactInput({ lastName: 'Bertin', type: 'acquereur', autresTypes: ['vendeur', 'inconnu'] });
    assert.ok(r.ok);
    assert.equal(r.fields.type, 'vendeur');
    assert.deepEqual(r.fields.autresTypes, ['acquereur']);
  });
});

describe('extraction — personnes et constats', () => {
  it('lit les rôles en liste', () => {
    const e = parseNoteExtraction(
      JSON.stringify({ personnes: [{ firstName: null, lastName: 'Bertin', types: ['acquereur', 'vendeur'] }] }),
      REF,
    );
    assert.equal(e.personnes[0]?.type, 'vendeur');
    assert.deepEqual(e.personnes[0]?.autresTypes, ['acquereur']);
  });

  it('comprend encore un « type » seul', () => {
    const e = parseNoteExtraction(JSON.stringify({ personnes: [{ lastName: 'Bertin', type: 'Acquéreur' }] }), REF);
    assert.equal(e.personnes[0]?.type, 'acquereur');
    assert.deepEqual(e.personnes[0]?.autresTypes, []);
  });

  it('garde un ravalement comme constat, sans doublon ni point final', () => {
    const e = parseNoteExtraction(
      JSON.stringify({
        address: '30 avenue Le Drurolin',
        observations: ['ravalement de façade en cours.', 'Ravalement de façade en cours', ''],
      }),
      REF,
    );
    assert.deepEqual(e.observations, ['Ravalement de façade en cours']);
    assert.deepEqual(e.actions, []);
  });

  it('un constat seul en chaîne est accepté', () => {
    const e = parseNoteExtraction(JSON.stringify({ observations: 'échafaudage sur la façade' }), REF);
    assert.deepEqual(e.observations, ['Échafaudage sur la façade']);
  });
});

describe('revue — fiche reconnue et constats', () => {
  const contacts = [
    {
      id: 'c1',
      agencyId: 'a',
      firstName: 'Janine',
      lastName: 'Bertin',
      fullName: 'Janine Bertin',
      phone: null,
      email: null,
      address: null,
      banId: null,
      type: 'vendeur' as const,
      autresTypes: [],
    },
  ];

  it('la fiche reconnue porte ses rôles', () => {
    const [m] = matchContacts({ firstName: 'Janine', lastName: 'Bertin', phone: null, email: null }, contacts, 'a');
    assert.deepEqual(m?.roles, ['vendeur']);
  });

  it('le constat devient une carte rattachée à l’adresse', () => {
    const review = buildReviewPayload({
      voiceNoteId: 'n1',
      transcript: 'Je suis devant le 30 avenue Le Drurolin, ils font un ravalement de façade.',
      visibilite: 'agence',
      extraction: parseNoteExtraction(
        JSON.stringify({ address: '30 avenue Le Drurolin', observations: ['Ravalement de façade en cours'] }),
        REF,
      ),
      extractFailed: false,
      contacts: [],
      agencyId: 'a',
      geo: { ban_id: null, adresse_normalisee: null, geocode_score: null },
      noteDate: REF,
    });
    assert.deepEqual(review.observations, [{ id: 'o0', texte: 'Ravalement de façade en cours', accepted: true }]);
    const carte = cartesDepuisReview(review, REF).find((c) => c.kind === 'observation');
    assert.equal(carte?.titre, 'Ravalement de façade en cours');
    assert.equal(carte?.detail, 'Au 30 avenue Le Drurolin');
  });
});

describe('repérage des noms dans le texte', () => {
  it('« Madame Bertin veut… » ne crée pas « Bertin Veut »', async () => {
    const { guessPersonnesFromTranscript } = await import('./from-transcript');
    const noms = guessPersonnesFromTranscript('Madame Bertin veut acquérir un nouvel appartement.').map(
      (p) => `${p.firstName}|${p.lastName}`,
    );
    assert.deepEqual(noms, ['|Bertin']);
  });

  it('une dictée sans majuscules non plus', async () => {
    const { guessPersonnesFromTranscript } = await import('./from-transcript');
    const noms = guessPersonnesFromTranscript('madame bertin veut vendre').map((p) => `${p.firstName}|${p.lastName}`);
    assert.deepEqual(noms, ['|Bertin']);
  });

  it('« Mme Bertin » devinée rejoint « Claire Bertin » lue par le modèle', () => {
    const review = buildReviewPayload({
      voiceNoteId: 'n2',
      transcript: 'Madame Bertin veut acquérir un nouvel appartement et vendre son bien.',
      visibilite: 'agence',
      extraction: parseNoteExtraction(
        JSON.stringify({ personnes: [{ firstName: 'Claire', lastName: 'Bertin', types: ['acquereur', 'vendeur'] }] }),
        REF,
      ),
      extractFailed: false,
      contacts: [],
      agencyId: 'a',
      geo: { ban_id: null, adresse_normalisee: null, geocode_score: null },
      noteDate: REF,
    });
    assert.equal(review.personnes.length, 1);
    // « Claire » n'est pas dans le texte : la revue ne garde pas un prénom inventé.
    assert.equal(review.personnes[0]?.personne.lastName, 'Bertin');
    assert.deepEqual(rolesDuContact(review.personnes[0]!.personne), ['vendeur', 'acquereur']);
  });
});
