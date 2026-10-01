import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { finDeNoteDite, retirerFinDeNote } from './fin-de-note';
import { termesContexte, vocabulaireDepuis } from './vocabulaire';
import { cartesDepuisReview, jourLisible } from './cartes';
import { bilanDuMois, formatMinutes, minutesEvitees } from '../notes/temps-gagne';
import { emptyReviewPayload } from '../notes/build-review';

describe('fin de note', () => {
  it('reconnaît la formule en fin de dictée et la retire', () => {
    assert.equal(finDeNoteDite('Rappeler Janine jeudi. Fin de note.'), true);
    assert.equal(retirerFinDeNote('Rappeler Janine jeudi. Fin de note.'), 'Rappeler Janine jeudi.');
  });
  it('ne coupe pas une note qui en parle au milieu', () => {
    assert.equal(finDeNoteDite('La fin de note de frais arrive demain, je le rappelle'), false);
  });
});

describe('vocabulaire', () => {
  it('découpe les noms composés en mots, sans particule, et dédoublonne', () => {
    assert.deepEqual(termesContexte('de La Fontaine'), ['Fontaine']);
    assert.deepEqual(vocabulaireDepuis(['Leroy', 'leroy', null, 'Al', 'Janine Martin']), ['Leroy', 'Janine', 'Martin']);
  });
});

describe('temps gagné', () => {
  it('compte la frappe et les fiches', () => {
    assert.equal(minutesEvitees({ caracteres: 600, contacts: 1, actions: 2 }), 7);
    assert.equal(formatMinutes(95), '1 h 35');
  });
  it('ne compte que le mois en cours, à l’heure de Paris', () => {
    const bilan = bilanDuMois(
      [
        { transcript: 'x'.repeat(300), createdAt: '2026-09-30T22:30:00Z' },
        { transcript: 'x'.repeat(300), createdAt: '2026-10-01T09:00:00Z' },
      ],
      new Date('2026-10-02T09:00:00Z'),
    );
    // 30 septembre 22h30 UTC = 1er octobre 0h30 à Paris : les deux comptent.
    assert.equal(bilan.notes, 2);
  });
});

describe('cartes comprises', () => {
  it('dit « demain » et « aujourd’hui »', () => {
    const maintenant = new Date('2026-09-30T10:00:00Z');
    assert.equal(jourLisible('2026-09-30', maintenant), 'aujourd’hui');
    assert.equal(jourLisible('2026-10-01', maintenant), 'demain');
  });
  it('donne une carte par chose comprise, avec des clés stables', () => {
    const review = {
      ...emptyReviewPayload('n1', 'texte'),
      personnes: [
        {
          id: 'p0',
          personne: { firstName: 'Janine', lastName: 'Martin', phone: null, email: null, type: 'vendeur' as const },
          matches: [],
        },
      ],
      actions: [
        {
          id: 'a0',
          type: 'rappel' as const,
          intitule: 'Rappeler Janine Martin',
          date: '2026-10-02',
          dateDeduite: false,
          heure: null,
          personne: 'Janine',
          personneRef: 'p0',
          lieu: null,
          rdvType: null,
          interet: null,
          accepted: true,
        },
      ],
      rooms: 3,
      prix: 450000,
    };
    const cartes = cartesDepuisReview(review, new Date('2026-09-30T10:00:00Z'));
    assert.deepEqual(
      cartes.map((c) => c.kind),
      ['personne', 'rappel', 'bien'],
    );
    assert.equal(cartes[0]?.badge, 'Nouveau contact');
    assert.equal(cartes[1]?.badge, 'Sur votre accueil');
    assert.deepEqual(
      cartesDepuisReview(review, new Date('2026-09-30T10:00:00Z')).map((c) => c.key),
      cartes.map((c) => c.key),
    );
  });
});
