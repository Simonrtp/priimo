import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptyReviewPayload, type NoteReviewPayload, type PersonneProposal } from './build-review';
import { completerFiche, completerReview } from './completer-review';
import { EMPTY_CONTACT_INPUT } from '@/lib/contact-input';
import type { ExtractedPersonne } from './propositions';
import type { ActionProposal } from './review-v2';

const benoit = (patch: Partial<ExtractedPersonne> = {}): ExtractedPersonne => ({
  firstName: 'Benoît',
  lastName: 'Ben Ali',
  phone: null,
  email: null,
  type: 'vendeur',
  autresTypes: ['acquereur'],
  ...patch,
});

const personne = (id: string, p: ExtractedPersonne): PersonneProposal => ({ id, personne: p, matches: [] });

const action = (id: string, intitule: string, accepted = true): ActionProposal => ({
  id,
  type: 'rappel',
  intitule,
  date: '2026-10-31',
  dateDeduite: true,
  heure: null,
  personne: null,
  personneRef: null,
  lieu: null,
  rdvType: null,
  interet: null,
  accepted,
});

function revue(patch: Partial<NoteReviewPayload>): NoteReviewPayload {
  return { ...emptyReviewPayload('n1', ''), ...patch };
}

describe('completerReview — une lecture arrive sur une revue retouchée', () => {
  it('pose le numéro dicté après coup sur la même fiche, sans en créer une autre', () => {
    const avant = revue({ personnes: [personne('p0', benoit())], visibilite: 'privee' });
    const lue = revue({ personnes: [personne('p0', benoit({ phone: '0766857165' }))] });
    const out = completerReview(avant, lue, 'texte complet');
    assert.equal(out.personnes.length, 1);
    assert.equal(out.personnes[0]?.id, 'p0');
    assert.equal(out.personnes[0]?.personne.phone, '0766857165');
    // Le partage choisi par l'agent reste.
    assert.equal(out.visibilite, 'privee');
  });

  it('reconnaît la personne écrite autrement par la nouvelle lecture', () => {
    const avant = revue({ personnes: [personne('p0', benoit({ lastName: 'Ali' }))] });
    const lue = revue({ personnes: [personne('p0', benoit({ firstName: 'Ben', lastName: 'Ali', phone: '0766857165' }))] });
    const out = completerReview(avant, lue, 'texte');
    assert.equal(out.personnes.length, 1);
    assert.equal(out.personnes[0]?.personne.phone, '0766857165');
  });

  it('ajoute une casquette dite plus tard, et la retire si la note la retire', () => {
    const avant = revue({ personnes: [personne('p0', benoit({ type: 'acquereur', autresTypes: [] }))] });
    const lue = revue({ personnes: [personne('p0', benoit({ type: 'vendeur', autresTypes: [] }))] });
    const ajout = completerReview(avant, lue, 'Il est aussi vendeur.');
    const p = ajout.personnes[0]!.personne;
    assert.deepEqual([p.type, ...(p.autresTypes ?? [])].sort(), ['acquereur', 'vendeur']);

    const retrait = completerReview(ajout, lue, 'Il est aussi vendeur. Finalement il ne vend plus.');
    assert.equal(retrait.personnes[0]!.personne.type, 'acquereur');
  });

  it('ajoute une nouvelle personne sans heurter les identifiants connus', () => {
    const avant = revue({ personnes: [personne('p0', benoit())] });
    const lue = revue({
      personnes: [personne('p0', { ...benoit(), firstName: 'Claire', lastName: 'Morel', type: 'acquereur', autresTypes: [] })],
    });
    const out = completerReview(avant, lue, 'texte');
    assert.deepEqual(
      out.personnes.map((p) => p.id),
      ['p0', 'p0-2'],
    );
  });

  it('garde les actions réglées par l’agent et ajoute seulement les nouvelles', () => {
    const avant = revue({ actions: [action('a0', 'Rappeler M. Ben Ali', false)] });
    const lue = revue({ actions: [action('a0', 'Rappeler M. Ben Ali'), action('a1', 'Envoyer les diagnostics')] });
    const out = completerReview(avant, lue, 'texte');
    assert.equal(out.actions.length, 2);
    assert.equal(out.actions[0]?.accepted, false);
    assert.equal(out.actions[1]?.intitule, 'Envoyer les diagnostics');
  });

  it('garde l’objet retouché du brouillon et ne remplit qu’un message vide', () => {
    const avant = revue({ email: { personneRef: null, destinataire: null, email: null, objet: 'Mon objet', corps: '' } });
    const lue = revue({ email: { personneRef: null, destinataire: null, email: null, objet: 'Autre', corps: 'Bonjour' } });
    const out = completerReview(avant, lue, 'texte');
    assert.equal(out.email?.objet, 'Mon objet');
    assert.equal(out.email?.corps, 'Bonjour');
  });
});

describe('completerFiche — fiche retouchée à la main', () => {
  const fields = { ...EMPTY_CONTACT_INPUT, firstName: 'Benoît', lastName: 'Ben Ali', type: 'vendeur' as const };

  it('reçoit le numéro dicté après la retouche', () => {
    const out = completerFiche(fields, benoit(), benoit({ phone: '0766857165' }), 'texte');
    assert.equal(out.phone, '0766857165');
  });

  it('ne laisse pas une lecture moins juste défaire le nom corrigé', () => {
    const out = completerFiche(fields, benoit(), benoit({ lastName: 'Ali' }), 'texte');
    assert.equal(out.lastName, 'Ben Ali');
  });

  it('ne change rien tant que la note n’a rien appris de neuf', () => {
    const corrige = { ...fields, phone: '0612345678' };
    assert.deepEqual(completerFiche(corrige, benoit(), benoit(), 'texte'), corrige);
  });
});
