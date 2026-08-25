import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  composeTypedNote,
  EMPTY_TYPED_NOTE_DRAFT,
  parseTypedNoteDraft,
  showsAcquereurCriteria,
  showsSource,
  showsVendeurBien,
} from './typed-compose';

describe('parseTypedNoteDraft', () => {
  it('refuse un kind inconnu', () => {
    assert.equal(parseTypedNoteDraft({ kind: 'voisin' }), null);
  });

  it('accepte un vendeur et ignore une source inventée', () => {
    const draft = parseTypedNoteDraft({
      kind: 'vendeur',
      sourceInfo: 'hacker',
      firstName: 'Marlène',
      surface: '30',
      body: 'Elle veut vendre.',
    });
    assert.ok(draft);
    assert.equal(draft.kind, 'vendeur');
    assert.equal(draft.sourceInfo, '');
    assert.equal(draft.firstName, 'Marlène');
  });
});

describe('composeTypedNote', () => {
  it('pose le type vendeur, les m² et l’immeuble dans le texte', () => {
    const { transcript, extraction } = composeTypedNote(
      {
        ...EMPTY_TYPED_NOTE_DRAFT,
        kind: 'vendeur',
        firstName: 'Marlène',
        surface: '30',
        rooms: '2',
        prix: '320000',
        body: 'Appartement au 6 rue des Maronites.',
      },
      '6 rue des Maronites, Paris',
    );
    assert.match(transcript, /Vendeur · Marlène/);
    assert.match(transcript, /30 m²/);
    assert.match(transcript, /Immeuble : 6 rue des Maronites/);
    assert.equal(extraction.personnes[0]?.type, 'vendeur');
    assert.equal(extraction.surface, 30);
    assert.equal(extraction.rooms, 2);
    assert.equal(extraction.prix, 320000);
    assert.equal(extraction.address, '6 rue des Maronites, Paris');
  });

  it('classe un acquéreur et prend le budget comme prix', () => {
    const { extraction } = composeTypedNote({
      ...EMPTY_TYPED_NOTE_DRAFT,
      kind: 'acquereur',
      firstName: 'Paul',
      lastName: 'Martin',
      prix: '450000',
      surface: '50',
      rooms: '3',
      secteur: '11e',
      body: 'Cherche dans le 11e.',
    });
    assert.equal(extraction.personnes[0]?.type, 'acquereur');
    assert.equal(extraction.prix, 450000);
    assert.equal(extraction.secteur, '11e');
  });

  it('fixe la source propriétaire sur une note propriétaire', () => {
    const { extraction, transcript } = composeTypedNote({
      ...EMPTY_TYPED_NOTE_DRAFT,
      kind: 'note_proprietaire',
      firstName: 'Jean',
      body: 'Pas vendeur pour le moment.',
    });
    assert.equal(extraction.sourceInfo, 'proprietaire');
    assert.equal(extraction.personnes[0]?.type, 'vendeur');
    assert.match(transcript, /Note propriétaire · Jean/);
  });

  it('garde la source choisie pour une information', () => {
    const { extraction } = composeTypedNote({
      ...EMPTY_TYPED_NOTE_DRAFT,
      kind: 'information',
      sourceInfo: 'gardien',
      body: 'Travaux dans la cage en septembre.',
    });
    assert.equal(extraction.sourceInfo, 'gardien');
    assert.equal(extraction.personnes.length, 0);
  });
});

describe('champs selon le kind', () => {
  it('montre le bien seulement pour un vendeur', () => {
    assert.equal(showsVendeurBien('vendeur'), true);
    assert.equal(showsVendeurBien('acquereur'), false);
    assert.equal(showsAcquereurCriteria('acquereur'), true);
    assert.equal(showsSource('information'), true);
    assert.equal(showsSource('note_proprietaire'), false);
  });
});
